const { program } = require('commander')
const Ajv = require('ajv')
const yaml = require('js-yaml')
const fs   = require('fs')

const schema = require('./specs-schema.json')

const WIDTH  = 1
const HEIGHT = 2

function run (argv) {

    const specs = init(argv)
    if (specs === null) {
        process.exit(1)
    }

    const ajv = new Ajv({useDefaults: true})
    const validate = ajv.compile(schema)

    if (!validate(specs)) {
        console.error(validate.errors)
        process.exit(1)
    }

    generateHead(specs)
    generateWinding(specs)
    generateTail()
}

function init(argv) {
    program
        .option('-c, --config <file>', 'Path to config file.')
        .option('-o, --output <file>', 'Path to gcode file.')
        .parse(argv)

    const options = program.opts()

    if (typeof options.config === 'undefined') {
        console.error(new Error('Can\'t select config file').message)
        return null
    }

    if (typeof options.output !== 'undefined') {
        var access = fs.createWriteStream(options.output, {flags: 'w'})
        process.stdout.write = access.write.bind(access)
    }

    try {
        return yaml.load(fs.readFileSync(options.config, 'utf8'))
    } catch (error) {
        console.error(error.message)
    }

    return null
}

function wireDiameter(specs, side = 0) {
    if (side === WIDTH) {
        return specs.wire.diameter + (specs.wire.diameterWidthCorrection || 0)
    }

    if (side === HEIGHT) {
        return specs.wire.diameter + (specs.wire.diameterHeightCorrection || 0)
    }

    return specs.wire.diameter
}

/* Повертає кут нахилу площини намотки від сторони A.
 */
function planeAngle(specs, level) {
    // TODO: розраховувати для кожного рівня/шару окремо, так як теоретично ми можемо змінити кут для рівня
    // FIXIT: виправити всі planeAngle(specs, 0)
    return 180 / Math.PI
        * Math.atan((specs.coil[level].sideB.radius - specs.coil[level].sideA.radius) / specs.coil[level].length)
}

/* Коефіцієнт відступу по X для урахування нахилу площини намотки.
 */
function rotationRatio(specs, level,  value) {
    return value * Math.cos(Math.PI / 180 * planeAngle(specs, 0)) // FIXIT
}

function calcNextLayer(specs, position) {
    position.layer++
    position.passed = 0
    position.direction = !position.direction

    const oldRadiusA = position.radiusA
    const oldRadiusB = position.radiusB

    const increaseDistanceA = wireDiameter(specs, HEIGHT)
        * Math.tan(Math.PI / 180 * (specs.coil[position.level].sideA.angle - position.planeAngle))
    const increaseDistanceB = wireDiameter(specs, HEIGHT)
        * Math.tan(Math.PI / 180 * (specs.coil[position.level].sideB.angle + position.planeAngle))

    const deltaDistance = wireDiameter(specs, HEIGHT)
        * Math.tan(Math.PI / 180 * position.planeAngle)

    position.distance += increaseDistanceA + increaseDistanceB

    const shiftXA = (increaseDistanceA + deltaDistance)
        * Math.cos(Math.PI / 180 * position.planeAngle)

    const shiftXB = (increaseDistanceB - deltaDistance)
        * Math.cos(Math.PI / 180 * position.planeAngle)

    const increaseRadiusA = wireDiameter(specs, HEIGHT)
        / Math.cos(Math.PI / 180 * position.planeAngle)
        - shiftXA * Math.tan(Math.PI / 180 * position.planeAngle)

    const increaseRadiusB = wireDiameter(specs, HEIGHT)
        / Math.cos(Math.PI / 180 * position.planeAngle)
        + shiftXB * Math.tan(Math.PI / 180 * position.planeAngle)

    position.radiusA += increaseRadiusA
    position.radiusB += increaseRadiusB

    console.error(';',
        'Turn to new layer:', position.layer,
        'Distance:', position.distance,
        'Radius A:', position.radiusA,
        'Radius B:', position.radiusB)

    if (position.direction) {
        const circumferenceA = (oldRadiusA + (position.radiusA - oldRadiusA) / 2) * 2 * Math.PI

        return getStep(specs, position, shiftXA, specs.turnYDistance, circumferenceA, false)
    }

    const circumferenceB = (oldRadiusB + (position.radiusB - oldRadiusB) / 2) * 2 * Math.PI

    return getStep(specs, position, shiftXB, specs.turnYDistance, circumferenceB, true)
}

function getSpeed(specs, position) {
    if (Object.hasOwn(specs, 'firstLayerSpeed') && position.layer === 1) {
        return specs.firstLayerSpeed
    }

    return specs.speed
}

/* Returns the factor for movement by the axis
 */
function turnShift(specs, position) {
    const fullTurnShift = rotationRatio(specs, position.level, wireDiameter(specs, WIDTH))

    if (position.passed + fullTurnShift <= position.distance) {
        return 1
    }

    return (position.distance - position.passed) / fullTurnShift
}

function makeTurn(specs, position) {
    const shiftFactor = turnShift(specs, position)

    const currentRadius = position.radiusA
        + position.passed * Math.sin(Math.PI / 180 * position.planeAngle)

    const passed = position.passed + wireDiameter(specs, WIDTH) * shiftFactor
    position.passed = (passed > position.distance) ? position.distance : passed

    const targetRadius = position.radiusA
        + (position.passed) * Math.sin(Math.PI / 180 * position.planeAngle)

    const circumference = (currentRadius + (targetRadius - currentRadius) / 2) * 2 * Math.PI

    const shiftX = rotationRatio(specs, position.level, wireDiameter(specs, WIDTH)) * shiftFactor
    const shiftY = specs.turnYDistance * shiftFactor

    return getStep(specs, position, shiftX, shiftY, circumference, position.direction)
}

function getStep(specs, position, x, y, circumference, direction) {
    let shiftX = x
    let shiftY = y

    if (position.wireLength + circumference > specs.wire.length) {
        const endFactor = ((position.wireLength + circumference - specs.wire.length) / circumference)

        shiftX *= endFactor
        shiftY *= endFactor
        position.wireLength = specs.wire.length
    } else {
        position.wireLength += circumference
    }

    shiftX *= (direction) ? 1 : -1;

    return `G1 F${getSpeed(specs, position)} X${shiftX} Y${shiftY} ; ${Math.round(position.wireLength)}`
}

function generateHead(specs) {
    const gcode = [
        'G0              ; Rapid Motion',
        'G91             ; Відносні координати',
        'G94             ; Units per Minute Mode',
        'G21             ; Метрична система',
        'G54             ; Обнуляємо координату',
        'G4 P1.5         ; Wait for 1.5 seconds before homming',
        '$H              ; Додому',
        'M0              ; Пауза',
    ]

    console.log(gcode.join('\n'))
}

function generateTail() {
    const gcode = [
        'M0              ; Пауза',
        'G90             ; Абсолютні координати',
        'G0 X400         ; Піднімаємо',
        'M2',
    ]

    console.log(gcode.join('\n'))
}

function distance(radiusA, radiusB, length) {
    const delta = Math.abs(radiusA - radiusB)

    return Math.sqrt(length * length + delta * delta)
}

function generateWinding(specs) {
    const position = {
        wireLength: 0,                          /* Накопичується довжина намотаного. */

        layer: 1,                               /* Шар. */
        level: 0,                               /* Рівень конфігурації шарів. */
        direction: true,                        /* Якщо true рухаємось вперед, інакше назад. */

        planeAngle: planeAngle(specs, 0),
        // TODO: перерахувати з урахуванням height, кутів і відступу напівдіаметру від стінок.
                                                /* Дистанція між точкою A та B. */
        distance: distance(specs.coil[0].sideA.radius, specs.coil[0].sideB.radius, specs.coil[0].length),
        // TODO: радіуси перерахувати з урахуванням зміщення height та по кутам відхилу стінки та площини
        radiusA: specs.coil[0].sideA.radius,    /* Радіус шару на початку котушки. */
        radiusB: specs.coil[0].sideB.radius,    /* Радіус шару на кінці котушки. */

        passed: 0,                              /* Пройдена дистанція в поточному шарі. */
    }

    do {
        if (position.passed >= position.distance) {
            const lastDistance = position.distance
            const lastRadiusA = position.radiusA
            const lastRadiusB = position.radiusB

            console.log(calcNextLayer(specs, position))
            if (position.wireLength >= specs.wire.length) {
                break
            }

            console.log(`; Layer ${position.layer} D: ${2 * (position.direction ? position.radiusA : position.radiusB)}`);
        }

        console.log(makeTurn(specs, position))
    } while (position.wireLength < specs.wire.length)
}

module.exports = {
    run,
    calcNextLayer,
    makeTurn,
}
