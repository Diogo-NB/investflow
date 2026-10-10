import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Nx registers the react-hooks plugin; enable its full Rules of React set.
    rules: reactHooks.configs.flat.recommended.rules,
  },
];
