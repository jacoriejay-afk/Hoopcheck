/** Identity and generation checks for private Creator Studio reads and saves. */
export function creatorStudioOwner(expected:string,actual:unknown):boolean{
  return Boolean(expected)&&actual===expected;
}
export function createStudioEpoch(){
  let generation=0,uid="";
  return {
    begin(){uid="";return ++generation;},
    invalidate(){uid="";generation++;},
    bind(epoch:number,owner:string){if(epoch===generation)uid=owner;},
    owner(){return uid;},
    epoch(){return generation;},
    current(epoch:number,owner?:string){return epoch===generation&&(owner===undefined||creatorStudioOwner(owner,uid));}
  };
}
