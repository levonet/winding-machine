const g = require('../scripts/g-generator')

describe('make turn', () => {

  describe('simple', () => {
    const specs = {
      coil: [{
        length: 10,
        sideA: {
          radius: 10,
          angle: 0,
        },
        sideB: {
          radius: 10,
          angle: 0,
        },
        angle: 0,
      }],
      wire: {
        diameter: 1,
        length: 100,
      },
      speed: 1,
      turnYDistance: 10,
      shiftX: 8,
    }

    test('at the start', () => {
      expect(g.makeTurn(specs, {
        wireLength: 0,
        layer: 1,
        level: 0,
        direction: true,
        planeAngle: 0,
        height: 1,
        distance: 10,
        radiusA: 10,
        radiusB: 10,
        passed: 0,
      })).toEqual({shiftX: 1, shiftY: 10})
    })

    test('in the midle', () => {
      expect(g.makeTurn(specs, {
        wireLength: 0,
        layer: 1,
        level: 0,
        direction: true,
        planeAngle: 0,
        height: 1,
        distance: 10,
        radiusA: 10,
        radiusB: 10,
        passed: 5,
      })).toEqual({shiftX: 1, shiftY: 10})
    })

    test('that is close to the end', () => {
      expect(g.makeTurn(specs, {
        wireLength: 0,
        layer: 1,
        level: 0,
        direction: true,
        planeAngle: 0,
        height: 1,
        distance: 10,
        radiusA: 10,
        radiusB: 10,
        passed: 9.5,
      })).toEqual({shiftX: 0.5, shiftY: 5})
    })

    test('at the end', () => {
      expect(g.makeTurn(specs, {
        wireLength: 0,
        layer: 1,
        level: 0,
        direction: true,
        planeAngle: 0,
        height: 1,
        distance: 10,
        radiusA: 10,
        radiusB: 10,
        passed: 10,
      })).toEqual({shiftX: 0, shiftY: 0})
    })
  })

})
