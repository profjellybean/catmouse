import{d as v,c as d,u as o,h as n,a as p,n as C,j as G,k as g,l as B,w as f,b as y,F as w,f as x,m as $,q as I,t as M,s as R,v as S,g as V}from"./index-7370479e.js";import{G as E}from"./game-5f0b135b.js";const F={key:0},N=v({__name:"GameOpponent",props:{mouse:null},setup(_){const e=_,l=d(()=>{var t;if(e.mouse.components.isAlive===!1)return null;let s=e.mouse.getComponent("pos");return(t=document.getElementById(s.x.toString()+" "+s.y.toString()))==null?void 0:t.getBoundingClientRect()});return(s,t)=>o(l)===null?(n(),p("div",F)):(n(),p("div",{key:1,class:"absolute h-2 w-2 bg-blue-400",style:C({top:`${o(l).top}px`,left:`${o(l).left}px`})},null,4))}}),P=v({__name:"GamePlayer",props:{player:null,controllable:{type:Boolean},gameService:null},setup(_){const e=_,l=d(()=>{var i;let u=e.player.getComponent("pos");return(i=document.getElementById(u.x.toString()+" "+u.y.toString()))==null?void 0:i.getBoundingClientRect()}),s=G(30),t=u=>{e.gameService.emit(e.player.id,"move",u)},c=g(()=>t("left"),s,{immediate:!1}),a=g(()=>t("down"),s,{immediate:!1}),m=g(()=>t("right"),s,{immediate:!1}),h=g(()=>t("up"),s,{immediate:!1});if(e.controllable){const{arrowleft:u,arrowdown:i,arrowright:b,arrowup:k}=B();f(u,r=>{r?c.resume():c.pause()}),f(i,r=>{r?a.resume():a.pause()}),f(b,r=>{r?m.resume():m.pause()}),f(k,r=>{r?h.resume():h.pause()})}return(u,i)=>(n(),p("div",{class:"absolute h-5 w-5 bg-pink-600",style:C({top:`${o(l).top}px`,left:`${o(l).left}px`})},null,4))}}),j={style:{border:"2px solid black"}},z=y("thead",null,null,-1),D=["id"],L=v({__name:"GameMap",props:{mapComp:null},setup(_){const e=_;return(l,s)=>(n(),p("div",null,[y("table",j,[z,y("tbody",null,[(n(!0),p(w,null,x(e.mapComp.value.map,(t,c)=>(n(),p("tr",{key:c},[(n(!0),p(w,null,x(t,(a,m)=>(n(),p("td",{class:"p-0",key:m},[y("div",{id:c+" "+m,class:$(["grid",{"bg-black":a.type=="underground","bg-white":a.type=="surface","bg-red-500":a.type=="entry","bg-yellow-500":a.type=="meeting"}])},null,10,D)]))),128))]))),128))])])]))}});const O={class:"h-full w-full bg-sky-700 flex justify-center items-center"},K=v({__name:"SinglePlayerGameView",setup(_){const e=new E,l="singleplayer",s=I(e.killCount);setTimeout(()=>{e.startGame([l])},1e3);const t=d(()=>e.currentState.value),c=d(()=>e.map),a=d(()=>t.value.players&&t.value.players[l]),m=d(()=>t.value.opponents);return(h,u)=>{const i=L,b=P,k=N;return n(),p("div",O,[y("h2",null,M(o(s).kills),1),R(i,{"map-comp":o(c)},null,8,["map-comp"]),o(a)!==void 0?(n(),S(b,{key:0,player:o(a),"game-service":o(e),controllable:""},null,8,["player","game-service"])):V("",!0),y("ul",null,[(n(!0),p(w,null,x(o(m),r=>(n(),S(k,{key:r.id,mouse:r},null,8,["mouse"]))),128))])])}}});export{K as default};
