import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "ASM LAB | 상태 변화로 배우는 RV32I";
const description =
  "실행 전에 다음 상태를 예측하고 레지스터, PC, 메모리의 변화를 한 단계씩 확인하는 한국어 RV32I 학습 실험실입니다.";
const socialDescription =
  "예측하고 실행하며 레지스터와 메모리가 왜 바뀌었는지 확인하세요.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const protocol =
    forwardedProtocol ?? (host?.startsWith("localhost") ? "http" : "https");
  let imageUrl: string | undefined;
  if (host) {
    try {
      imageUrl = new URL("/og.png", `${protocol}://${host}`).toString();
    } catch {
      imageUrl = undefined;
    }
  }

  return {
    title: {
      default: title,
      template: "%s | ASM LAB",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "ASM LAB",
      title,
      description: socialDescription,
      images: imageUrl ? [{ url: imageUrl, width: 1536, height: 1024 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: socialDescription,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
