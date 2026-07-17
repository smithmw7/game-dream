import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1) || 'game-dream';
const nativeBuild = process.env.CAPACITOR_BUILD === 'true';

export default defineConfig({
  base: nativeBuild ? './' : (process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/game-dream/'),
});
