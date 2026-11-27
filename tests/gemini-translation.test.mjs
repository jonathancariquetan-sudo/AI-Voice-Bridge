import test from 'node:test';
import assert from 'node:assert/strict';
import {translateAudio} from '../netlify/lib/gemini-translation.mjs';
const base={apiKey:'synthetic-test-key',model:'test-model',audioBase64:'AA==',mimeType:'audio/wav',sourceLanguage:'ar-SA',targetLanguage:'en-US'};
for(const [sourceLanguage,targetLanguage,originalText,translatedText] of [
['ar-SA','en-US','مرحبا','Hello'],['en-US','ar-SA','Hello','مرحبا'],['fil-PH','en-US','Salamat','Thank you'],['en-US','fil-PH','Thank you','Salamat']]){
 test(sourceLanguage+' to '+targetLanguage+' mocked response',async()=>{
 const result=await translateAudio({...base,sourceLanguage,targetLanguage,fetchImpl:async(url,options)=>{
 assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
 assert.equal(options.headers['x-goog-api-key'],base.apiKey);
 assert.ok(!url.includes(base.apiKey));
 const body=JSON.parse(options.body);
 assert.equal(body.contents[0].parts[1].inlineData.data,base.audioBase64);
 assert.ok(body.contents[0].parts[0].text.includes(targetLanguage));
 return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({originalText,translatedText})}]}}]})};
 }});
 assert.deepEqual(result,{originalText,translatedText});
 });
}
test('missing configuration prevents network call',async()=>{await assert.rejects(translateAudio({...base,apiKey:'',fetchImpl:async()=>assert.fail('unexpected call')}),/configuration/);});
test('upstream error is sanitized',async()=>{await assert.rejects(translateAudio({...base,fetchImpl:async()=>({ok:false,status:429})}),/429/);});
test('invalid response rejected',async()=>{await assert.rejects(translateAudio({...base,fetchImpl:async()=>({ok:true,json:async()=>({})})}),/Invalid Gemini response/);});
