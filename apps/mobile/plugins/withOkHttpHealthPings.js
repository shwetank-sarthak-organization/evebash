// Android (#260): React Native's HTTP client (OkHttp) has no timeouts and never checks that a pooled HTTP/2
// connection is still alive. When the phone's network path to Supabase dies silently, every later request is sent
// down that dead connection and hangs until lib/supabase.ts gives up after 20 s, until the app is restarted.
// A ping every PING_SECONDS lets OkHttp notice a dead connection (no answer by the next ping), fail it and open a
// new one. Everything else stays React Native's default client (same cookie jar, 10 MB cache, no timeouts).
const { withMainApplication } = require('expo/config-plugins');

const PING_SECONDS = 10;
const MARKER = 'OkHttpClientProvider.setOkHttpClientFactory';
const IMPORTS = [
  'import com.facebook.react.modules.network.OkHttpClientProvider',
  'import java.util.concurrent.TimeUnit',
];
const SETUP = [
  '    // Pings find dead HTTP/2 connections so requests don\'t hang on them (plugins/withOkHttpHealthPings.js, #260)',
  `    ${MARKER} {`,
  `      OkHttpClientProvider.createClientBuilder(applicationContext).pingInterval(${PING_SECONDS}, TimeUnit.SECONDS).build()`,
  '    }',
].join('\n');

module.exports = function withOkHttpHealthPings(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withOkHttpHealthPings: expected a Kotlin MainApplication');
    }
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;

    const lastImport = [...src.matchAll(/^import .+$/gm)].pop();
    if (!lastImport || !src.includes('super.onCreate()\n')) {
      throw new Error('withOkHttpHealthPings: MainApplication.kt no longer has the expected imports / onCreate');
    }
    const at = lastImport.index + lastImport[0].length;
    src = `${src.slice(0, at)}\n${IMPORTS.filter((line) => !src.includes(line)).join('\n')}${src.slice(at)}`;
    src = src.replace('super.onCreate()\n', `super.onCreate()\n${SETUP}\n`);

    cfg.modResults.contents = src;
    return cfg;
  });
};
