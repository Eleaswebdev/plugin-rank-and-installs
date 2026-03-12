import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

export default function ApiAccess() {
  const [copied, setCopied] = useState(false);
  const appUrl = window.location.origin.replace(/\/$/, '');
  const exampleSlug = 'classic-editor';
  const apiUrl = `${appUrl}/api/plugin-estimate/${exampleSlug}`;

  const codeSnippet = `
// Example: Fetching data from site2.com
async function getPluginData(slug) {
  // Ensure baseUrl has no trailing slash
  const baseUrl = "${appUrl}";
  const response = await fetch(\`\${baseUrl}/api/plugin-estimate/\${slug}\`);
  const data = await response.json();
  
  return data;
}
  `.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 mt-12">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-serif text-xl text-stone-900">Public API Access</h3>
            <p className="text-sm text-stone-500">Use this data on your other websites (site2.com)</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 mb-2 block">
              Your API Endpoint
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-stone-50 p-3 rounded-xl text-xs text-stone-600 border border-stone-100 break-all">
                {apiUrl}
              </code>
              <button 
                onClick={copyToClipboard}
                className="p-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center min-w-[44px]"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 mb-2 block">
              JavaScript Implementation
            </label>
            <pre className="bg-stone-900 text-stone-300 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto leading-relaxed">
              {codeSnippet}
            </pre>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4">
            <p className="text-xs text-emerald-800 leading-relaxed">
              <span className="font-semibold">Important:</span> If you see a CORS error or a 302 Redirect, ensure you are using the <span className="font-bold">Shared App URL</span> (the one starting with <code className="bg-emerald-100 px-1 rounded">ais-pre-</code>) instead of your private developer URL. The private URL requires authentication and will redirect API calls, causing CORS to fail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
