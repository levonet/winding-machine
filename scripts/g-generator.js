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

function planeAngle(specs) {
    return 180 / Math.PI
        * Math.atan((specs.coil.sideB.radius - specs.coil.sideA.radius) / specs.coil.length)
}

function rotationRatio(specs, value) {
    return value * Math.cos(Math.PI / 180 * planeAngle(specs))
}

function nextLayer(specs, position) {
    position.layer++
    position.passed = 0
    position.direction = !position.direction
    position.height += wireDiameter(specs, HEIGHT)

    position.distance = rotationRatio(specs, (specs.coil.length -  wireDiameter(specs, WIDTH))
        + (position.height + ((!position.direction) ? wireDiameter(specs, WIDTH) : 0))
            * Math.tan(Math.PI / 180 * specs.coil.sideA.angle)
        + (position.height + ((position.direction) ? wireDiameter(specs, WIDTH) : 0))
            * Math.tan(Math.PI / 180 * specs.coil.sideB.angle))

    const outspreadA = position.height * Math.tan(Math.PI / 180 * specs.coil.sideA.angle)
    position.radiusA = specs.coil.sideA.radius
        + Math.sqrt(position.height * position.height + outspreadA * outspreadA)
        * Math.cos(Math.PI / 180 * (specs.coil.sideA.angle - planeAngle(specs)))

    const outspreadB = position.height * Math.tan(Math.PI / 180 * specs.coil.sideB.angle)
    position.radiusB = specs.coil.sideB.radius
        + Math.sqrt(position.height * position.height + outspreadB * outspreadB)
        * Math.cos(Math.PI / 180 * (specs.coil.sideB.angle + planeAngle(specs)))

    return position
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
    const fullTurnShift = rotationRatio(specs, wireDiameter(specs, WIDTH))

    if (position.passed + fullTurnShift <= position.distance) {
        return 1
    }

    return (position.distance - position.passed) / fullTurnShift
}

function makeTurn(specs, position) {
    const shiftFactor = turnShift(specs, position)

    const radius = (position.radiusA - position.radiusB)
        * ((position.direction)
            ? (position.passed / position.distance)
            : 1 - (position.passed / position.distance))
        * shiftFactor

    const circumference = (position.radiusA + radius) * 2 * Math.PI

    let shiftX = rotationRatio(specs, wireDiameter(specs, WIDTH)) * shiftFactor
    let shiftY = specs.turnYDistance * shiftFactor

    if (position.wireLength + circumference > specs.wire.length) {
        const endFactor = ((position.wireLength + circumference - specs.wire.length) / circumference)

        shiftX *= endFactor
        shiftY *= endFactor
        position.wireLength = specs.wire.length
    } else {
        position.passed += shiftX
        position.wireLength += circumference
    }

    shiftX *= (position.direction) ? 1 : -1;

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

function generateWinding(specs) {
    const position = {
        wireLength: 0,                          /* Накопичується довжина намотаного. */

        layer: 0,                               /* Шар */
        direction: false,                       /* Якщо true рухаємось вперед, інакше назад. */
        height: -1 * wireDiameter(specs, HEIGHT) / 2, /* Умовна висота початкового шару. */

        distance: 0,                            /* Дистанція між сторонами A та B. */
        radiusA: 0,                             /* Радіус шару на початку котушки. */
        radiusB: 0,                             /* Радіус шару на кінці котушки. */

        passed: 0,                              /* Пройдена дистанція в поточному шарі. */
    }

    do {
        if (position.passed >= position.distance) {
            nextLayer(specs, position)
            console.log(`; Layer ${position.layer} D: ${2 * (position.direction ? position.radiusA : position.radiusB)}`);
        }

        console.log(makeTurn(specs, position))
    } while (position.wireLength < specs.wire.length)
}

module.exports = {
    run,
    nextLayer,
    makeTurn,
}
