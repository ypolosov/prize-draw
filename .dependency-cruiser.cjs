// Архитектурные правила розыгрыша (fitness functions): проверяются в npm run lint и в CI.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Циклы между модулями запрещены.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment:
        'Правила R1-R6 и выбор победителей (api/src/domain) - чистые функции: без NestJS, базы и ' +
        'остального API. Так результат розыгрыша может пересчитать любой (ADR-3).',
      from: { path: '^api/src/domain/' },
      to: { pathNot: '^api/src/domain/', dependencyTypesNot: ['core'] },
    },
    {
      name: 'web-does-not-import-api',
      severity: 'error',
      comment: 'Веб-приложение говорит с API только по HTTP.',
      from: { path: '^web/' },
      to: { path: '^api/' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Импорт должен разрешаться в существующий модуль.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
