import type { Metadata } from "next";
import "./globals.css";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { PHProvider } from "@/components/PostHogProvider";

export const metadata: Metadata = {
  title: "YASS — Yet Another Simple Signup",
  description: "Fair event signups without the cognitive overhead.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Auth0Provider>
          <PHProvider>{children}</PHProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
