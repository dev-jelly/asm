import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const title = "ASM LAB | 상태 변화로 배우는 RV32I";
const description =
  "실행 전에 다음 상태를 예측하고 PC, 레지스터, 메모리, 분기의 변화를 한 단계씩 확인하는 한국어 RV32I 학습 실험실입니다.";
const socialDescription =
  "예측하고 실행하며 PC, 레지스터, 메모리, 분기가 왜 바뀌었는지 확인하세요.";

// GitHub Pages 정적 배포용 고정 메타데이터. vinext는 Next.js 순정과 달리
// 메타데이터 URL에 basePath를 자동으로 붙이지 않으므로 아이콘과 OG 이미지는
// 절대 경로/URL로 명시한다.
const SITE_URL = "https://dev-jelly.github.io/asm";
const OG_IMAGE_URL = `${SITE_URL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: "%s | ASM LAB",
  },
  description,
  icons: {
    icon: "/asm/favicon.svg",
    shortcut: "/asm/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "ASM LAB",
    title,
    description: socialDescription,
    images: [{ url: OG_IMAGE_URL, width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: socialDescription,
    images: [OG_IMAGE_URL],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
