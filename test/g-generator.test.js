const g = require('../scripts/g-generator')

test('simple turn', () => {
  expect(g.makeTurn({
    coil: {
      length: 100,
      sideA: {
        radius: 10,
        angle: 0,
      },
      sideB: {
        radius: 10,
        angle: 0,
      },
      angle: 0,
    },
    wire: {
      diameter: 1,
      length: 1000,
    },
    speed: 123,
    turnYDistance: 10,
    shiftX: 8,
  }, {
    wireLength: 0,
    layer: 1,
    direction: false,
    height: 1,
    distance: 0,
    radiusA: 10,
    radiusB: 10,
    passed: 0,
  })).toBe('')
})
