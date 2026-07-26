import vinext from "vinext";
import { defineConfig } from "vite";

// 정적 export 빌드. GitHub Pages 프로젝트 사이트(dev-jelly.github.io/asm/)의
// 하위 경로에 배포하므로 에셋 접두를 /asm/로 고정한다. 라우팅용 basePath는
// 프리렌더 서버와 충돌하므로 에셋 접두(base)만 단독으로 사용한다.
export default defineConfig({
  base: "/asm/",
  plugins: [vinext()],
});
