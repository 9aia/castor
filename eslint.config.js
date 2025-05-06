import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    '@typescript-eslint/no-namespace': 'off',
    'vars-on-top': 'off',
    'no-var': 'off',
  },
})
