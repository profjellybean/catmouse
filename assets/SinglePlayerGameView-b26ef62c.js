import{d as b,c as d,h as o,a as l,n as S,u as p,j as B,k as f,l as C,w as v,b as g,F as k,f as x,m as $,q as I,s as G,g as M}from"./index-b05410dc.js";import{G as V}from"./game-659976e2.js";const E=b({__name:"GameOpponent",props:{mouse:null},setup(i){const e=i,a=d(()=>{var n;let t=e.mouse.getComponent("pos");return(n=document.getElementById(t.x.toString()+" "+t.y.toString()))==null?void 0:n.getBoundingClientRect()});return(t,n)=>(o(),l("div",{class:"absolute h-2 w-2 bg-blue-400",style:S({top:`${p(a).top}px`,left:`${p(a).left}px`})},null,4))}}),F=b({__name:"GamePlayer",props:{player:null,controllable:{type:Boolean},gameService:null},setup(i){const e=i,a=d(()=>{var u;let r=e.player.getComponent("pos");return(u=document.getElementById(r.x.toString()+" "+r.y.toString()))==null?void 0:u.getBoundingClientRect()}),t=B(30),n=r=>{e.gameService.emit(e.player.id,"move",r)},c=f(()=>n("left"),t,{immediate:!1}),s=f(()=>n("down"),t,{immediate:!1}),_=f(()=>n("right"),t,{immediate:!1}),h=f(()=>n("up"),t,{immediate:!1});if(e.controllable){const{arrowleft:r,arrowdown:u,arrowright:w,arrowup:y}=C();v(r,m=>{m?c.resume():c.pause()}),v(u,m=>{m?s.resume():s.pause()}),v(w,m=>{m?_.resume():_.pause()}),v(y,m=>{m?h.resume():h.pause()})}return(r,u)=>(o(),l("div",{class:"absolute h-5 w-5 bg-pink-600",style:S({top:`${p(a).top}px`,left:`${p(a).left}px`})},null,4))}}),N={style:{border:"2px solid black"}},P=g("thead",null,null,-1),R=["id"],j=b({__name:"GameMap",props:{mapComp:null},setup(i){const e=i;return(a,t)=>(o(),l("div",null,[g("table",N,[P,g("tbody",null,[(o(!0),l(k,null,x(e.mapComp.value.map,(n,c)=>(o(),l("tr",{key:c},[(o(!0),l(k,null,x(n,(s,_)=>(o(),l("td",{class:"p-0",key:_},[g("div",{id:c+" "+_,class:$(["grid",{"bg-black":s.type=="underground","bg-white":s.type=="surface","bg-red-500":s.type=="entry","bg-yellow-500":s.type=="meeting","ring-2 ring-red-500":s.occupied!==null}])},null,10,R)]))),128))]))),128))])])]))}});const z={class:"h-full w-full bg-sky-700 flex justify-center items-center"},q=b({__name:"SinglePlayerGameView",setup(i){const e=new V,a="singleplayer";setTimeout(()=>{e.startGame([a])},1e3);const t=d(()=>e.currentState.value),n=d(()=>e.map),c=d(()=>t.value.players&&t.value.players[a]),s=d(()=>t.value.opponents);return(_,h)=>{const r=j,u=F,w=E;return o(),l("div",z,[I(r,{"map-comp":p(n)},null,8,["map-comp"]),p(c)!==void 0?(o(),G(u,{key:0,player:p(c),"game-service":p(e),controllable:""},null,8,["player","game-service"])):M("",!0),g("ul",null,[(o(!0),l(k,null,x(p(s),y=>(o(),G(w,{key:y.id,mouse:y},null,8,["mouse"]))),128))])])}}});export{q as default};
