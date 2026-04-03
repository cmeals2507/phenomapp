module.exports = {
  appId: 'edu.uh.phenomapp',
  productName: 'PhenomApp',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**',
    'main.js',
    'preload.js',
    'about.html',
    'src/db/**',
    'src/utils/exportFormatters.js',
    'package.json',
  ],
  asar: true,
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/*.node',
  ],
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['universal'],
      },
    ],
    category: 'public.app-category.productivity',
    identity: null,
    icon: 'PhenomAppIcon.png',
  },
  npmRebuild: true,
};
