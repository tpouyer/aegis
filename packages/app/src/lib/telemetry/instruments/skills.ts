import { getSkillsMeter } from '../meters'

const pluginLoadDuration = getSkillsMeter().createHistogram('skills.plugin.load.duration', {
  description: 'Time to load plugin metadata',
  unit: 'ms',
})

const pluginLoadErrors = getSkillsMeter().createCounter('skills.plugin.load.error.count', {
  description: 'Plugin loading failures',
  unit: '{error}',
})

const fileReadCount = getSkillsMeter().createCounter('skills.file.read.count', {
  description: 'Skill file reads',
  unit: '{read}',
})

const fileCacheHits = getSkillsMeter().createCounter('skills.file.cache.hits', {
  description: 'Cache hits for skill files',
  unit: '{hit}',
})

const fileCacheMisses = getSkillsMeter().createCounter('skills.file.cache.misses', {
  description: 'Cache misses for skill files',
  unit: '{miss}',
})

const scriptDuration = getSkillsMeter().createHistogram('skills.script.execution.duration', {
  description: 'Script execution time',
  unit: 'ms',
})

const scriptErrors = getSkillsMeter().createCounter('skills.script.execution.error.count', {
  description: 'Script execution failures',
  unit: '{error}',
})

const scriptExitCodes = getSkillsMeter().createHistogram('skills.script.exit_code', {
  description: 'Distribution of script exit codes',
  unit: '{code}',
})

const pyodideLoadDuration = getSkillsMeter().createHistogram('skills.pyodide.load.duration', {
  description: 'Pyodide runtime load time',
  unit: 'ms',
})

const marketplaceRefreshDuration = getSkillsMeter().createHistogram('skills.marketplace.refresh.duration', {
  description: 'Time to refresh marketplace catalog',
  unit: 'ms',
})

export function recordPluginLoadStart(pluginId: string) {
  const startTime = performance.now()
  return {
    success() {
      pluginLoadDuration.record(performance.now() - startTime, { 'plugin.id': pluginId })
    },
    error(errorType: string) {
      pluginLoadErrors.add(1, { 'plugin.id': pluginId, 'error.type': errorType })
    },
  }
}

export function recordSkillFileRead(skillId: string, cached: boolean) {
  fileReadCount.add(1, { 'skill.id': skillId, 'file.cached': String(cached) })
  if (cached) {
    fileCacheHits.add(1, { 'skill.id': skillId })
  } else {
    fileCacheMisses.add(1, { 'skill.id': skillId })
  }
}

export function recordScriptExecutionStart(language: 'python' | 'bash') {
  const startTime = performance.now()
  return {
    end(exitCode: number) {
      const duration = performance.now() - startTime
      scriptDuration.record(duration, { 'script.language': language })
      scriptExitCodes.record(exitCode, { 'script.language': language })
      if (exitCode !== 0) {
        scriptErrors.add(1, { 'script.language': language, 'error.type': `exit_${exitCode}` })
      }
    },
  }
}

export function recordPyodideLoad() {
  const startTime = performance.now()
  return {
    end() {
      pyodideLoadDuration.record(performance.now() - startTime)
    },
  }
}

export function recordMarketplaceRefreshStart(marketplaceId: string) {
  const startTime = performance.now()
  return {
    end() {
      marketplaceRefreshDuration.record(performance.now() - startTime, { 'marketplace.id': marketplaceId })
    },
  }
}
