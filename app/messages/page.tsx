import type {Metadata} from "next";
import Link from "next/link";
import HoopChatCourtside from "../../components/HoopChatCourtside";

export const metadata:Metadata={
  title:"HoopChat Courtside | HoopCheck",
  description:"Basketball conversations, contact requests and your private HoopChat inbox."
};

export default function MessagesPage(){
  return <main className="page-shell hc-courtside-page"><div className="page-container">
    <nav className="hc-courtside-breadcrumb" aria-label="Messaging navigation">
      <Link href="/dashboard">Home</Link><span aria-hidden="true">/</span>
      <Link href="/notifications">Alerts</Link><span aria-hidden="true">/</span>
      <strong>Courtside</strong>
    </nav>
    <HoopChatCourtside/>
    <div className="hc-courtside-footer"><span>Need your basketball community?</span>
      <Link href="/hoopgroups">Open HoopGroups</Link>
      <Link href="/players">Find players</Link>
    </div>
  </div></main>;
}
