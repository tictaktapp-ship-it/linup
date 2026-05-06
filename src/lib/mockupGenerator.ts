import { OPENROUTER_KEY, GROQ_BASE_URL } from './config';

export interface MockupSpec {
  screen: string;
  type: string;
  header: string;
  sections: string[];
  primary_action: string;
}

export function parseMockupBlocks(text: string): MockupSpec[] {
  const mockups: MockupSpec[] = [];
  const regex = /MOCKUP_START\n([\s\S]*?)MOCKUP_END/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const block = match[1];
    const get = (key: string) => {
      const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const sections = get('sections').split(',').map(s => s.trim()).filter(Boolean);
    mockups.push({
      screen: get('screen'),
      type: get('type'),
      header: get('header'),
      sections,
      primary_action: get('primary_action'),
    });
  }
  return mockups;
}

export async function generateMockupSVG(spec: MockupSpec): Promise<string> {
  const key = OPENROUTER_KEY;
  if (!key) return '';

  const prompt = `Generate a clean SVG wireframe for a "${spec.type}" screen called "${spec.screen}".

Layout requirements:
- Header/nav: ${spec.header}
- Sections: ${spec.sections.join(', ')}
- Primary action button: "${spec.primary_action}"

SVG requirements:
- viewBox="0 0 360 640" (mobile-first)
- Background: #F4F4F2
- Use #E0E0DE for empty placeholder boxes
- Use #1A1A18 for text labels (font-size 10-12px, font-family system-ui)
- Use #8C00B4 for the primary action button
- Use #FFFFFF for card backgrounds with subtle border #E0E0DE
- Show realistic proportions and spacing
- Include a status bar at top (20px, #0C0C0E)
- Show a bottom nav bar if applicable
- Make it look like a real lo-fi wireframe, not abstract shapes
- Output ONLY the SVG element, no explanation, no markdown`;

  try {
    const r = await fetch(GROQ_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'content-type': 'application/json',
        'HTTP-Referer': 'https://linup.io',
        'X-Title': 'LINUP Mockups',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const content: string = d.choices?.[0]?.message?.content ?? '';
    // Extract SVG from response
    const svgMatch = content.match(/<svg[\s\S]*<\/svg>/);
    return svgMatch ? svgMatch[0] : '';
  } catch (e) {
    console.error('Mockup generation failed:', e);
    return '';
  }
}