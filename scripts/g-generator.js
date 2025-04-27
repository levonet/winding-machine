const { program } = require('commander')
const yaml = require('js-yaml')
const fs   = require('fs')

function run (argv) {

    const specs = init(argv)
    if (specs === null) {
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
        return yaml.load(fs.readFileSync(options.config, 'utf8')) /* TODO: Spec validator */
    } catch (error) {
        console.error(error.message)
    }

    return null
}

function rotationRatio(specs, value) {
    return value * Math.cos(Math.PI / 180 * specs.coil.angle)
}

function nextLayer(specs, position) {
    position.layer++
    position.passed = 0
    position.direction = !position.direction
    position.height += specs.wire.diameter

    position.distance = rotationRatio(specs, specs.coil.length
        + (position.height + ((!position.direction) ? specs.wire.diameter : 0))
            * Math.tan(Math.PI / 180 * specs.coil.sideA.angle)
        + (position.height + ((position.direction) ? specs.wire.diameter : 0))
            * Math.tan(Math.PI / 180 * specs.coil.sideB.angle))

    const outspreadA = position.height * Math.tan(Math.PI / 180 * specs.coil.sideA.angle)
    position.radiusA = specs.coil.sideA.radius
        + Math.sqrt(position.height * position.height + outspreadA * outspreadA)
        * Math.cos(Math.PI / 180 * (specs.coil.sideA.angle - specs.coil.angle))

    const outspreadB = position.height * Math.tan(Math.PI / 180 * specs.coil.sideB.angle)
    position.radiusB = specs.coil.sideB.radius
        + Math.sqrt(position.height * position.height + outspreadB * outspreadB)
        * Math.cos(Math.PI / 180 * (specs.coil.sideB.angle + specs.coil.angle))

    return position
}

function getSpeed(specs, position) {
    if (Object.hasOwn(specs, 'firstLayerSpeed') && position.layer === 1) {
        return specs.firstLayerSpeed
    }

    return specs.speed
}

function makeTurn(specs, position) {
    /* TODO: Support of diagonal winding */
    const fullTurnShift = rotationRatio(specs, specs.wire.diameter)

    let turnShift = (position.passed + fullTurnShift <= position.distance)
        ? fullTurnShift
        : position.distance - position.passed

    const radius = (position.radiusA - position.radiusB)
        * ((position.direction)
            ? (position.passed / position.distance)
            : 1 - (position.passed / position.distance))
        * turnShift / fullTurnShift

    const circumference = (position.radiusA + radius) * 2 * Math.PI

    if (position.wireLength + circumference > specs.wire.length) {
        turnShift *= ((position.wireLength + circumference - specs.wire.length) / circumference)
        position.wireLength = specs.wire.length
    } else {
        position.passed += turnShift
        position.wireLength += circumference
    }

    return `G1 F${getSpeed(specs, position)} X${turnShift * ((position.direction) ? 1 : -1)} Y${specs.turnYDistance * turnShift / fullTurnShift} ; ${Math.round(position.wireLength)}`
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
        height: -1 * specs.wire.diameter / 2,   /* Умовна висота початкового шару. */

        distance: 0,                            /* Дистанція між сторонами A та B. */
        radiusA: 0,
        radiusB: 0,

        passed: 0,                              /* Пройдена дистанція в поточному шарі. */
    }

    do {
        if (position.passed >= position.distance) {
            nextLayer(specs, position)
            console.log(`; Start Layer D: ${2 * (position.direction ? position.radiusA : position.radiusB)}`);
        }

        console.log(makeTurn(specs, position))
    } while (position.wireLength < specs.wire.length)
}

module.exports = {
    run,
    nextLayer,
    makeTurn,
}
