import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages 프로젝트 사이트(dev-jelly.github.io/asm/)로 정적 배포.
  // vinext는 output:"export"를 지원하며 dist/client/에 HTML을 직접 쓴다.
  // 에셋 경로 접두(/asm/)는 vite.config.ts의 base로 처리한다.
  // (next.config의 basePath를 쓰면 프리렌더 서버 라우팅과 충돌해 404가 발생한다.)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
