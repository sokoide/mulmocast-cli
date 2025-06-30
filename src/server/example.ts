// Usage example for MulmocastService
import { MulmocastService } from '../lib/mulmocast-service.js';

async function example(): Promise<void> {
  const service = new MulmocastService();

  try {
    // Example 1: Generate script only
    console.log('🎬 Generating script...');
    const scriptResult = await service.generateScript(
      "風を追いかけて──ユーシャンの道\n山に囲まれた小さな村に、サッカーが大好きな少年ユーシャンがいた。",
      {
        templateName: 'familyday_jpn',
        llm: 'openai',
        filename: 'example'
      }
    );
    console.log('✅ Script generated:', scriptResult);

    // Example 2: Generate all outputs
    // console.log('\n🎥 Generating all outputs...');
    // const allResult = await service.generateAll(
    //   "小さな丸い宇宙人プーニが地球にやってきて、人間の少年と友達になる物語。",
    //   {
    //     templateName: 'familyday_jpn',
    //     outputs: ['script', 'video', 'pdf'],
    //     llm: 'openAI',
    //     filename: 'puni-story'
    //   }
    // );
    // console.log('✅ All outputs generated:', allResult);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the example
example().catch(console.error);

export { example };