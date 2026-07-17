import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1) || 'game-dream';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/game-dream/',
});
