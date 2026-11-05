import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
	variable: "--font-manrope",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
	title: "Nexova | Human Resources Consulting and Talent Acquisition",
	description: "Nexova helps technology, retail, and financial services companies build exceptional teams through talent acquisition, customer support, and training.",
};

export const viewport: Viewport = { themeColor: "#edf4ff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${manrope.variable} h-full antialiased`}>
			<body className="min-h-full">{children}</body>
		</html>
	);
}