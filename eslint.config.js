import neostandard from 'neostandard'

// gitignore-to-minimatch treats dot-directories such as `.public` as files,
// so `**/.public` does not cover the Vite build output inside them.
const ignores = neostandard
  .resolveIgnoresFromGitignore()
  .flatMap((pattern) =>
    pattern.endsWith('/**') ? [pattern] : [pattern, `${pattern}/**`]
  )

export default [
  { ignores },
  ...neostandard({
    env: ['node', 'vitest'],
    ignores,
    noJsx: true,
    noStyle: true
  })
]
