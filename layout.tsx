import './globals.css'
import Link from 'next/link'
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><header><Link href="/" className="logo">HOOPCHECK</Link><nav><Link href="/explore">Explore</Link><Link href="/subscribe">Plans</Link><Link href="/dashboard">Dashboard</Link></nav></header><main>{children}</main><footer>HoopCheck • Built for players, by players</footer></body></html>}
