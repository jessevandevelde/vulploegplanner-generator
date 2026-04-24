import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import angularEslint from 'angular-eslint';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

const eslintConfig = defineConfig(
  eslint.configs.recommended,
  stylistic.configs.recommended,
  {
    rules: {
      '@stylistic/comma-dangle': [
        'error',
        'always-multiline',
      ],
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'],
        },
      ],
      'no-restricted-syntax': 'error',
      '@stylistic/padding-line-between-statements': ['error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: ['const', 'let'] },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
        { blankLine: 'always', prev: '*', next: 'multiline-const' },
        { blankLine: 'always', prev: 'multiline-const', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-let' },
        { blankLine: 'always', prev: 'multiline-let', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-expression' },
        { blankLine: 'always', prev: 'multiline-expression', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'any', prev: 'case', next: 'case' },
        { blankLine: 'any', prev: 'case', next: 'default' },
        { blankLine: 'always', prev: ['import'], next: '*' },
        { blankLine: 'any', prev: ['import'], next: ['import'] },
        { blankLine: 'always', prev: ['expression'], next: '*' },
        { blankLine: 'always', prev: '*', next: ['expression'] },
        { blankLine: 'any', prev: ['expression'], next: ['expression'] },
        { blankLine: 'any', prev: '*', next: 'break' },
      ],
      '@stylistic/semi': ['error', 'always'],
    },
  },
);

const tseslintConfig = defineConfig(
  {
    plugins: {
      '@stylistic': stylistic,
    },
    extends: [
      eslintConfig,
      ...tseslint.configs.all,
      ...tseslint.configs.stylistic,
    ],
    rules: {
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/max-params': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-magic-numbers': ['error', {
        ignoreEnums: true,
        ignoreDefaultValues: true,
        ignoreReadonlyClassProperties: true,
        ignoreClassFieldInitialValues: true,
        ignoreArrayIndexes: true,
        ignoreNumericLiteralTypes: true,
        ignore: [-1, 0, 1],
      }],
      '@typescript-eslint/no-extraneous-class': [
        'error',
        {
          allowWithDecorator: true,
        },
      ],
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowTernary: true,
        },
      ],
    },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },
  },
);

export default defineConfig(
  {
    ignores: ['node_modules', 'dist'],
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [eslintConfig],
  },
  {
    files: ['**/*.ts'],
    extends: [
      tseslintConfig,
      angularEslint.configs.tsRecommended,
    ],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'vpg',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'vpg',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angularEslint.configs.templateAll],
    rules: {
      '@angular-eslint/template/i18n': 'off',
      '@angular-eslint/template/no-call-expression': 'off',
      '@angular-eslint/template/attributes-order': [
        'error',
        {
          alphabetical: true,
          order: [
            'STRUCTURAL_DIRECTIVE',
            'ATTRIBUTE_BINDING',
            'TWO_WAY_BINDING',
            'OUTPUT_BINDING',
            'INPUT_BINDING',
            'TEMPLATE_REFERENCE',
          ],
        },
      ],
    },
  },
);
