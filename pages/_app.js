import '../styles/globals.css';
import Script from 'next/script';
import {useRouter} from 'next/router';

export default function App({ Component, pageProps }) {
  const {pathname}=useRouter();
  if(pathname==='/access' || pathname==='/admin/access') return <Component {...pageProps} />;
  return (
    <>
      <Script
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4344666254384298"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Component {...pageProps} />
      <a href="/access" style={{position:'fixed',bottom:12,left:12,zIndex:70,padding:'8px 12px',borderRadius:9,background:'#fafaf6',color:'#263c2f',fontSize:12,textDecoration:'none',border:'1px solid #dce4d8'}}>계정 · 이용 승인</a>
    </>
  );
}
