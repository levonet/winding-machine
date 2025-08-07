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

    generateHead()
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

function isInLevel(specs, position, radiusA, radiusB) {
    if (specs.coil.length === (position.level + 1)) {
        return true
    }

    if (specs.coil.length > (position.level + 1)) {
        if (position.direction
            && Object.hasOwn(specs.coil[position.level + 1], 'sideA')
            && specs.coil[position.level + 1].sideA.radius <= radiusA) {
            return false
        }

        if (!position.direction
            && Object.hasOwn(specs.coil[position.level + 1], 'sideB')
            && specs.coil[position.level + 1].sideB.radius <= radiusB) {
            return false
        }
    }

    return true
}

function switchLevel(specs, position) {
    // TODO: Зараз не підтримується одночасна зміна кута з обох боків.
    // Для цього маємо помітити сторону, де відбулись зміни відносно попереднього рівня.
    if (!Object.hasOwn(specs.coil[position.level + 1], 'sideA')) {
        specs.coil[position.level + 1].sideA = specs.coil[position.level].sideA
    }

    if (!Object.hasOwn(specs.coil[position.level + 1], 'sideB')) {
        specs.coil[position.level + 1].sideB = specs.coil[position.level].sideB
    }

    // Довжина використовується тільки на етапі ініціалізації
    // specs.coil[position.level + 1].length = specs.coil[position.level].length

    position.level++
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

function newLayerChanges(specs, position) {
    const increaseDistanceA = wireDiameter(specs, WIDTH)
        * Math.tan(Math.PI / 180 * (specs.coil[position.level].sideA.angle - position.planeAngle))
    const increaseDistanceB = wireDiameter(specs, WIDTH)
        * Math.tan(Math.PI / 180 * (specs.coil[position.level].sideB.angle + position.planeAngle))

    const deltaDistance = wireDiameter(specs, WIDTH)
        * Math.tan(Math.PI / 180 * position.planeAngle)

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

    return {
        increaseDistanceA,
        increaseDistanceB,
        shiftXA,
        shiftXB,
        increaseRadiusA,
        increaseRadiusB
    }
}

function calcNextLayer(specs, position) {
    position.layer++
    position.passed = 0
    position.direction = !position.direction

    const oldRadiusA = position.radiusA
    const oldRadiusB = position.radiusB

    let change = newLayerChanges(specs, position)

    if (!isInLevel(specs, position, position.radiusA + change.increaseRadiusA,
        position.radiusB + change.increaseRadiusB)) {

        const oldAngleA = specs.coil[position.level].sideA.angle
        const oldAngleB = specs.coil[position.level].sideB.angle
        switchLevel(specs, position)

        let shiftA0 = 0
        let shiftB0 = 0

        if (position.direction) {
            // FIXIT: Це копіпаст sideB, потрібно виправити напрямок відхилення кутів.
            const startRadiusA = specs.coil[position.level].sideA.radius
            const startShiftA1 = (position.radiusA - startRadiusA) * Math.tan(Math.PI / 180 * oldAngleA)
            const pathOldAtoStartA = (oldAngleA) ? startShiftA1 / Math.sin(Math.PI / 180 * oldAngleA) : 0
            const angleA = specs.coil[position.level].sideA.angle - oldAngleA
            const pathOldAtoA0 = (pathOldAtoStartA * Math.sin(Math.PI / 180 * (angleA)))
                / Math.sin(Math.PI / 180 * (180 + angleA + (oldAngleA + position.planeAngle - 90)))
            const heightA0 = (pathOldAtoA0) * Math.sin(Math.PI / 180 * position.planeAngle)
            shiftA0 = rotationRatio(specs, position.level, pathOldAtoA0)
            const radiusA0 = startRadiusA + (position.radiusA - startRadiusA + heightA0)

            position.distance += pathOldAtoA0
            position.radiusA = radiusA0
        }

        if (!position.direction) {
            const startRadiusB = specs.coil[position.level].sideB.radius
            const startShiftB1 = (position.radiusB - startRadiusB) * Math.tan(Math.PI / 180 * oldAngleB)
            const pathOldBtoStartB = (oldAngleB) ? startShiftB1 / Math.sin(Math.PI / 180 * oldAngleB) : 0
            const angleB = specs.coil[position.level].sideB.angle - oldAngleB
            const pathOldBtoB0 = (pathOldBtoStartB * Math.sin(Math.PI / 180 * (angleB)))
                / Math.sin(Math.PI / 180 * (180 + angleB + (oldAngleB + position.planeAngle - 90)))
            const heightB0 = (pathOldBtoB0) * Math.sin(Math.PI / 180 * position.planeAngle)
            shiftB0 = rotationRatio(specs, position.level, pathOldBtoB0)
            const radiusB0 = startRadiusB + (position.radiusB - startRadiusB + heightB0)

            position.distance += pathOldBtoB0
            position.radiusB = radiusB0
        }

        change = newLayerChanges(specs, position)
        change.shiftXA += shiftA0
        change.shiftXB += shiftB0
    }

    position.distance += change.increaseDistanceA + change.increaseDistanceB
    if (position.distance <= 0) {
        throw new Error(`'distance' has wrong length: ${position.distance}`)
    }

    position.radiusA += change.increaseRadiusA
    position.radiusB += change.increaseRadiusB

    console.error(';',
        'Turn to new LL:', position.level, ':', position.layer,
        'Distance:', position.distance,
        'Radius A:', position.radiusA,
        'Radius B:', position.radiusB)

    if (position.direction) {
        const circumferenceA = (oldRadiusA + (position.radiusA - oldRadiusA) / 2) * 2 * Math.PI

        return getStep(specs, position, change.shiftXA, specs.turnYDistance, circumferenceA, false)
    }

    const circumferenceB = (oldRadiusB + (position.radiusB - oldRadiusB) / 2) * 2 * Math.PI

    return getStep(specs, position, change.shiftXB, specs.turnYDistance, circumferenceB, true)
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

function generateHead() {
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
                                                /* Радіус шару на початку котушки. */
        radiusA: specs.coil[0].sideA.radius + wireDiameter(specs, HEIGHT) / 2,
        // radiusA: specs.coil[0].sideA.radius,
                                                /* Радіус шару на кінці котушки. */
        radiusB: specs.coil[0].sideB.radius + wireDiameter(specs, HEIGHT) / 2,
        // radiusB: specs.coil[0].sideB.radius,

        passed: 0,                              /* Пройдена дистанція в поточному шарі. */
    }

    do {
        if (position.passed >= position.distance) {
            try {
                console.log(calcNextLayer(specs, position))
            } catch (err) {
                console.error(err)
                break
            }

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
