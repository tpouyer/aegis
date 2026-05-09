import { getBoardMeter } from '../meters'

const starToggled = getBoardMeter().createCounter('board.star.toggled', {
  description: 'Board star/unstar interactions',
  unit: '{toggle}',
})

const filterApplied = getBoardMeter().createCounter('board.filter.applied', {
  description: 'Filter usage in board picker',
  unit: '{filter}',
})

const quickAccessOpened = getBoardMeter().createCounter('board.navigation.quick_access', {
  description: 'Starred quick access dropdown interactions',
  unit: '{open}',
})

const boardViewLoaded = getBoardMeter().createCounter('board.view.loaded', {
  description: 'Board view loads',
  unit: '{load}',
})

const boardSearchUsed = getBoardMeter().createCounter('board.navigation.search', {
  description: 'Board name searches',
  unit: '{search}',
})

export function recordBoardStarToggle(action: 'star' | 'unstar') {
  starToggled.add(1, { action })
}

export function recordBoardFilterApplied(filterType: string) {
  filterApplied.add(1, { 'filter.type': filterType })
}

export function recordBoardQuickAccess() {
  quickAccessOpened.add(1)
}

export function recordBoardViewLoad(boardId: number, boardType: string) {
  boardViewLoaded.add(1, { 'board.id': String(boardId), 'board.type': boardType })
}

export function recordBoardSearch() {
  boardSearchUsed.add(1)
}
