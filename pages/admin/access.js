import React,{useState,useEffect} from 'react';
import Head from 'next/head';
import {accessCall,button} from '../access';
const h=React.createElement;
export default function AccessAdmin() {
  const [users,setUsers]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){try{setUsers((await accessCall('users')).users);setError('');}catch(e){setError(e.message);}}
  useEffect(()=>{refresh();},[]);
  async function decide(user,status){setBusy(true);try{await accessCall('decision',{uid:user.uid,status});await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return h('main',{style:{maxWidth:850,margin:'0 auto',padding:'48px 24px',fontFamily:'system-ui',color:'#263c2f'}},
    h(Head,null,h('title',null,'사용자 승인 관리 · 유메카'),h('meta',{name:'robots',content:'noindex,nofollow'})),
    h('p',null,'youmeca'),h('h1',null,'사용자 승인 관리'),h('p',null,'승인한 계정만 기존 서비스를 이용할 수 있습니다. 권한을 회수하면 다음 요청부터 차단됩니다.'),
    h('p',null,h('a',{href:'/'},'기존 서비스로 이동'),' · ',h('a',{href:'/access'},'내 로그인 상태')),
    error&&h('p',{role:'alert',style:{color:'#a43026'}},error),
    h('button',{style:button,onClick:refresh,disabled:busy},'목록 새로고침'),
    !users.length&&h('p',null,'아직 승인 요청이 없습니다.'),
    h('div',null,users.map(user=>h('section',{key:user.uid,style:{padding:'24px 0',borderBottom:'1px solid #dce4d8',display:'flex',gap:20,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}},
      h('div',null,h('strong',null,user.email),h('p',{style:{marginBottom:0}},({pending:'승인 대기',approved:'승인됨',revoked:'권한 회수'})[user.status]||'확인 필요')),
      h('div',{style:{display:'flex',gap:10}},user.status!=='approved'&&h('button',{style:button,disabled:busy,onClick:()=>decide(user,'approved'),'aria-label':user.email+' 승인'},'승인'),user.status!=='revoked'&&h('button',{style:{...button,background:'#f1e8e3',color:'#8a3528'},disabled:busy,onClick:()=>decide(user,'revoked'),'aria-label':user.email+' 권한 회수'},user.status==='pending'?'거절':'권한 회수'))))));
}
