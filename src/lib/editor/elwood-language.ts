// Copied from Elwood playground — Monaco language definition for .elwood scripts.
// Provides syntax highlighting, bracket matching, and autocomplete.

import type { languages } from 'monaco-editor';

export const ELWOOD_LANGUAGE_ID = 'elwood';

export const monarchTokensProvider: languages.IMonarchLanguage = {
  defaultToken: '',
  ignoreCase: false,
  keywords: [
    'let', 'return', 'if', 'then', 'else', 'true', 'false', 'null',
    'memo', 'match', 'from', 'asc', 'desc', 'on', 'equals', 'into',
  ],
  pipeOperators: [
    'where', 'select', 'selectMany', 'orderBy', 'groupBy', 'distinct',
    'take', 'skip', 'batch', 'join', 'concat', 'reduce', 'index',
    'count', 'sum', 'min', 'max', 'first', 'last', 'any', 'all',
  ],
  builtinMethods: [
    'toLower', 'toUpper', 'trim', 'trimStart', 'trimEnd',
    'left', 'right', 'padLeft', 'padRight',
    'contains', 'startsWith', 'endsWith', 'replace', 'substring', 'split',
    'length', 'toCharArray', 'regex', 'urlDecode', 'urlEncode', 'sanitize',
    'round', 'floor', 'ceiling', 'truncate', 'abs',
    'toString', 'toNumber', 'convertTo', 'boolean', 'not',
    'isNull', 'isEmpty', 'isNullOrEmpty', 'isNullOrWhiteSpace',
    'clone', 'keep', 'remove',
    'hash', 'rsaSign', 'newGuid',
    'now', 'utcNow', 'dateFormat', 'tryDateFormat', 'add', 'toUnixTimeSeconds',
    'in', 'count', 'first', 'last', 'sum', 'min', 'max', 'index',
    'take', 'skip', 'concat', 'range', 'newGuid',
    'fromCsv', 'toCsv', 'fromXml', 'toXml', 'fromText', 'toText', 'parseJson',
    'fromXlsx', 'toXlsx', 'fromParquet', 'toParquet',
  ],
  operators: ['==', '!=', '>=', '<=', '=>', '&&', '||', '...', '..', '|', '+', '-', '*', '/', '>', '<', '!', '='],
  symbols: /[=><!~?:&|+\-*\/\^%\.]+/,
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/`/, 'string.interpolated', '@interpolatedString'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/\d+(\.\d+)?/, 'number'],
      [/\$\.\./, 'variable.path'],
      [/\$\./, 'variable.path'],
      [/\$\w+/, 'variable.path'],
      [/\$/, 'variable.path'],
      [/\|(?!\|)/, { token: 'delimiter.pipe', next: '@pipeOperator' }],
      [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@builtinMethods': 'support.function', '@default': 'identifier' } }],
      [/\.\.\./, 'operator'],
      [/=>/, 'operator.arrow'],
      [/==|!=|>=|<=|&&|\|\|/, 'operator'],
      [/[+\-*\/><!=]/, 'operator'],
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [/[,;:]/, 'delimiter'],
      [/\*/, 'operator.wildcard'],
    ],
    pipeOperator: [
      [/\s+/, 'white'],
      [/[a-zA-Z_]\w*/, { cases: { '@pipeOperators': { token: 'keyword.pipe', next: '@pop' }, '@keywords': { token: 'keyword', next: '@pop' }, '@default': { token: 'identifier', next: '@pop' } } }],
      ['', '', '@pop'],
    ],
    comment: [[/[^\/*]+/, 'comment'], [/\*\//, 'comment', '@pop'], [/[\/*]/, 'comment']],
    string_double: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']],
    string_single: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop']],
    interpolatedString: [
      [/\{/, { token: 'string.interpolated.bracket', next: '@interpolatedExpr' }],
      [/[^`{]+/, 'string.interpolated'],
      [/`/, 'string.interpolated', '@pop'],
    ],
    interpolatedExpr: [[/\}/, { token: 'string.interpolated.bracket', next: '@pop' }], { include: 'root' }],
  },
};

export const languageConfiguration: languages.LanguageConfiguration = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [['{', '}'], ['[', ']'], ['(', ')']],
  autoClosingPairs: [
    { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
    { open: '`', close: '`', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
    { open: '"', close: '"' }, { open: "'", close: "'" }, { open: '`', close: '`' },
  ],
};

export function registerElwoodLanguage(monaco: typeof import('monaco-editor')) {
  monaco.languages.register({ id: ELWOOD_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(ELWOOD_LANGUAGE_ID, monarchTokensProvider);
  monaco.languages.setLanguageConfiguration(ELWOOD_LANGUAGE_ID, languageConfiguration);
}
