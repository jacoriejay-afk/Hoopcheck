import type {Metadata} from "next";
import Link from "next/link";
import HoopChatCourtside from "../../components/HoopChatCourtside";

export const metadata:Metadata={
  title:"HoopChat Courtside | HoopCheck",
  description:"Basketball conversations, contact requests and your private HoopChat inbox."
};

export default function MessagesPage(){
  return <main className="page-shell hc-courtside-page"><div className="page-container">
    <header className="hc-simple-page-heading hc-messages-heading">
      <h1>Messages</h1><p>HoopChat conversations and requests in one inbox.</p>
    </header>
    <HoopChatCourtside/>
    <div className="hc-courtside-footer"><span>Find your basketball community</span>
      <Link href="/hoopgroups">Open HoopGroups</Link>
      <Link href="/players">Find players</Link>
    </div>
  </div></main>;
}
