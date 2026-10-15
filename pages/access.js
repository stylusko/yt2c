import React,{useState,useEffect} from 'react';
import Head from 'next/head';
const h=React.createElement;
export const panel={width:'min(480px,100%)',background:'#fff',border:'1px solid #dce4d8',borderRadius:20,padding:32,boxSizing:'border-box'};
export const button={padding:'12px 18px',border:0,borderRadius:10,background:'#334f3c',color:'#fff',cursor:'pointer',fontSize:15};
const field={width:'100%',boxSizing:'border-box',padding:13,border:'1px solid #cdd7ca',borderRadius:8,fontSize:16,marginTop:7,marginBottom:18};
export async function accessCall(action,body) {
  const response=await fetch('/api/access/'+action,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const result=await response.json();if(!response.ok) throw new Error(result.error||'요청을 처리하지 못했습니다.');return result;
}
function nextPath() {
  const next=new URLSearchParams(window.location.search).get('next')||'/';
  return next.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')&&!next.startsWith('/access')&&!next.startsWith('/bmonly')?next:'/';
}
export default function Access() {
  const [user,setUser]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  useEffect(()=>{accessCall('session').then(setUser).catch(e=>setError(e.message)).finally(()=>setBusy(false));},[]);
  async function act(action,body) {
    setBusy(true);setError('');
    try {const result=await accessCall(action,body);setUser(action==='logout'?{authenticated:false}:result);setPassword('');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return h('main',{style:{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,boxSizing:'border-box',background:'#fafaf6',color:'#263c2f',fontFamily:'system-ui'}},
    h(Head,null,h('title',null,'이용 승인 · 유메카'),h('meta',{name:'robots',content:'noindex,nofollow'})),
    h('section',{style:panel},h('p',{style:{fontWeight:750,marginTop:0}},'youmeca'),h('h1',{style:{fontSize:27}},'승인된 사용자만 이용할 수 있어요'),
      h('p',{style:{lineHeight:1.7,color:'#65715f'}},'기존 유메카는 관리자가 허용한 계정만 이용할 수 있습니다. 유메카 계정으로 로그인한 뒤 승인을 요청해 주세요.'),
      error&&h('p',{role:'alert',style:{color:'#a43026',lineHeight:1.6}},error),
      busy&&h('p',{role:'status'},'확인 중…'),
      !busy&&user?.authenticated?h(React.Fragment,null,
        h('p',null,user.email),
        user.approved?h(React.Fragment,null,h('p',{role:'status'},'이용이 승인되었습니다.'),h('button',{style:button,onClick:()=>{window.location.href=nextPath();}},'기존 서비스 열기'),user.admin&&h('p',null,h('a',{href:'/admin/access',style:{color:'#334f3c'}},'사용자 승인 관리'))):h(React.Fragment,null,
          h('p',{role:'status'},user.status==='pending'?'승인 요청을 보냈습니다. 관리자가 승인하면 이용할 수 있습니다.':user.status==='revoked'?'이용 권한이 회수되었습니다. 관리자에게 문의해 주세요.':'이 계정은 아직 이용 승인을 받지 않았습니다.'),
          user.status==='unrequested'&&h('button',{style:button,onClick:()=>act('request',{})},'승인 요청하기'),
          h('p',null,h('button',{style:{...button,background:'#eef1e9',color:'#334f3c'},onClick:()=>act('session')},'승인 상태 새로 확인'))),
        h('p',null,h('button',{style:{background:'none',border:0,color:'#65715f',cursor:'pointer',padding:0},onClick:()=>act('logout',{})},'로그아웃'))
      ):!busy&&h('form',{onSubmit:e=>{e.preventDefault();act('login',{email,password});}},
        h('label',null,'이메일',h('input',{style:field,type:'email',name:'email',autoComplete:'username',required:true,value:email,onChange:e=>setEmail(e.target.value)})),
        h('label',null,'비밀번호',h('input',{style:field,type:'password',name:'password',autoComplete:'current-password',required:true,value:password,onChange:e=>setPassword(e.target.value)})),
        h('button',{style:{...button,width:'100%'},type:'submit'},'로그인'),
        h('p',{style:{fontSize:13,color:'#65715f',lineHeight:1.6}},'계정이 없다면 새 유메카 앱에서 이메일 계정을 먼저 만들어 주세요.'))));
}
