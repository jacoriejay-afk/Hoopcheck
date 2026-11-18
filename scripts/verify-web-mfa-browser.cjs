/* eslint-disable @typescript-eslint/no-require-imports -- Entirely isolated localhost Auth server. */
const http=require('node:http'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'../apps/mobile/node_modules/playwright');
const base=process.env.MFA_WEB_TEST_URL||'http://127.0.0.1:3110',authPort=Number(process.env.MFA_AUTH_FIXTURE_PORT||3111);
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local fixture only');
const uid='11111111-1111-4111-8111-111111111111',primary='22222222-2222-4222-8222-222222222222',backup='33333333-3333-4333-8333-333333333333',extra='44444444-4444-4444-8444-444444444444';
let level,factors;const exp=Math.floor(Date.now()/1000)+3600;
const user=()=>({id:uid,aud:'authenticated',email:'fixture@example.test',factors});
const jwt=()=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp,aal:level,role:'authenticated'})).toString('base64url')+'.fixture';
const session=()=>({access_token:jwt(),refresh_token:'fixture',expires_in:3600,expires_at:exp,token_type:'bearer',user:user()});
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+authPort);res.setHeader('Access-Control-Allow-Origin',base);res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,PUT,OPTIONS');res.setHeader('Content-Type','application/json');
 const json=(value,status=200)=>{res.statusCode=status;res.end(JSON.stringify(value));};if(req.method==='OPTIONS')return json({});
 try{let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):{};
  if(url.pathname==='/auth/v1/user')return json(user());
  if(url.pathname==='/auth/v1/token')return json(session());
  if(url.pathname==='/auth/v1/logout')return json({});
  if(url.pathname==='/auth/v1/factors'&&req.method==='POST'){factors.push({id:extra,factor_type:'totp',status:'unverified',friendly_name:body.friendly_name});return json({id:extra,type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/></svg>'}});}
  if(url.pathname.endsWith('/challenge'))return json({id:'55555555-5555-4555-8555-555555555555',expires_at:Math.floor(Date.now()/1000)+60});
  if(url.pathname.endsWith('/verify')){if(body.code!=='123456')return json({code:'mfa_verification_failed',message:'Fixture incorrect code'},400);const factor=factors.find(f=>f.id===url.pathname.split('/')[4]);assert.ok(factor);factor.status='verified';level='aal2';return json(session());}
  if(url.pathname.startsWith('/auth/v1/factors/')&&req.method==='DELETE'){const id=url.pathname.split('/')[4];factors=factors.filter(f=>f.id!==id);return json({id});}
  if(url.pathname.startsWith('/rest/v1/'))return json([]);
  return json({error:'Unexpected fixture request'},404);
 }catch(error){console.error(error.message);return json({error:'Fixture failed'},500);}
});
async function verify(browser,theme){
 level='aal1';factors=[{id:primary,factor_type:'totp',status:'verified',friendly_name:'Primary'},{id:backup,factor_type:'totp',status:'verified',friendly_name:'Backup'}];
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme});await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),url:base,sameSite:'Lax'}]);
 await context.routeWebSocket('**/*',socket=>socket.close());await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(base).origin||url.origin===`http://127.0.0.1:${authPort}`)return route.continue();return route.fulfill({contentType:'application/json',body:'[]'});});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/account/security');await page.getByRole('heading',{name:'Verify your authenticator',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/auth/verify');
  await page.getByLabel('Authenticator',{exact:true}).selectOption(backup);await page.getByLabel('Six-digit authenticator code',{exact:true}).fill('000000');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.getByText('The code was not accepted. Use a fresh code and try again.',{exact:true}).waitFor();
  await page.getByLabel('Six-digit authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();await page.getByRole('heading',{name:'Two-factor authentication',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/account/security');
  await page.getByLabel('Authenticator device name',{exact:true}).fill('Travel backup');await page.getByRole('button',{name:'Add backup authenticator',exact:true}).click();await page.getByRole('button',{name:'Show setup key',exact:true}).click();await page.getByText('JBSWY3DPEHPK3PXP',{exact:true}).waitFor();
  await page.getByLabel('Six-digit authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and enable authenticator',exact:true}).click();await page.getByText('3 verified authenticators',{exact:true}).waitFor();assert.equal(await page.getByText('JBSWY3DPEHPK3PXP',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Remove Primary',exact:true}).click();await page.getByLabel('Verify removal with',{exact:true}).selectOption(backup);await page.getByLabel('Six-digit authenticator code',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify and remove authenticator',exact:true}).click();await page.getByText('2 verified authenticators',{exact:true}).waitFor();assert.equal(factors.some(f=>f.id===primary),false);
  await page.screenshot({path:`/tmp/hoopcheck-native-ui/web-mfa-${theme}.png`,fullPage:true});assert.deepEqual(errors,[]);console.log(`PASS website ${theme}: SSR redirect/challenge/backup/enrollment/removal/security refresh`);
 }catch(error){console.log(await page.locator('body').innerText());console.log(errors);throw error;}finally{await context.close();}
}
(async()=>{fs.mkdirSync('/tmp/hoopcheck-native-ui',{recursive:true});await new Promise(resolve=>server.listen(authPort,'127.0.0.1',resolve));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{for(const theme of ['light','dark'])await verify(browser,theme);}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{server.close();console.error(error);process.exitCode=1;});
