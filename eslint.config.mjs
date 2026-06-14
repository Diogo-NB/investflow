import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'layer:infrastructure',
                'layer:application',
                'layer:domain',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain', 'scope:shared'],
            },
            {
              sourceTag: 'layer:application',
              onlyDependOnLibsWithTags: [
                'layer:domain',
                'layer:application',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'layer:infrastructure',
              onlyDependOnLibsWithTags: [
                'layer:application',
                'layer:domain',
                'layer:infrastructure',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
];
