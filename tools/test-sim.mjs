import { simulateMatch } from '../backend/src/txodds/simulator.js'
import { PitchGrid } from '../backend/src/txodds/parser.js'

const grid = new PitchGrid()
console.log('before:', grid.getData().homeScore, grid.getData().phase)

const stop = simulateMatch(grid, 1)

await new Promise(r => setTimeout(r, 1200))
console.log('after 1.2s:', grid.getData().homeScore, grid.getData().phase, grid.getData().possession)
stop()
