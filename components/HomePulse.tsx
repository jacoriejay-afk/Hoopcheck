import Link from "next/link";
type PulseProps={live:number|null;upcoming:number|null;followedClubs:number;recentReviews?:number;fan?:boolean};
export default function HomePulse({live,upcoming,followedClubs,recentReviews=0,fan=false}:PulseProps){
 const entries=[
  {key:"games",label:"Live games",value:live,detail:live===null?"Open games hub":live>0?"Games in progress":"No live games reported",href:fan?"/fan-live":"/live-games",live:live!==null&&live>0},
  {key:"upcoming",label:"Upcoming",value:upcoming,detail:upcoming===null?"Open schedule":"Scheduled games",href:fan?"/fan-live":"/live-games",live:false},
  {key:"clubs",label:"Following",value:followedClubs,detail:"Clubs in this directory",href:"/teams",live:false},
  ...(!fan?[{key:"reviews",label:"Recent reviews",value:recentReviews,detail:"From followed clubs",href:"/reviews",live:false}]:[])
 ];
 return <section className="hc-smooth-pulse" aria-label="Your basketball pulse"><div className="hc-smooth-pulse__heading"><span className="eyebrow">YOUR BASKETBALL PULSE</span><Link href="/notifications">Activity inbox →</Link></div><div className="hc-smooth-pulse__grid">{entries.map(item=><Link className="hc-smooth-pulse__item hc-smooth-card" href={item.href} key={item.key}><span className="hc-smooth-pulse__label">{item.live&&<i aria-hidden="true" className="hc-smooth-pulse__live"/>}{item.label}</span><strong>{item.value===null?"—":item.value}</strong><small>{item.detail}</small></Link>)}</div></section>;
}
