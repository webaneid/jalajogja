// Tweaks application: primary color variations
const { useState, useEffect } = React;

const PRIMARY_PRESETS = [
  { name: 'Hijau Tua (default)', primary: '#0B6A5B', dark: '#085044', light: '#E8F2EF' },
  { name: 'Forest Deep', primary: '#1F5F3F', dark: '#143F2A', light: '#E6F0EA' },
  { name: 'Emerald Modern', primary: '#0F8A65', dark: '#0A6048', light: '#E6F4EE' },
  { name: 'Teal Tenang', primary: '#0E7C7B', dark: '#0A5E5D', light: '#E5F2F2' },
  { name: 'Olive Hangat', primary: '#5F7A3A', dark: '#445628', light: '#EEF1E5' },
  { name: 'Maroon Lembut', primary: '#7A3B3B', dark: '#5C2828', light: '#F4E8E8' },
];

function TweaksApp() {
  const defaults = window.__TWEAK_DEFAULTS__ || {};
  const [tweaks, setTweak] = useTweaks({
    primary: defaults.primary || '#0B6A5B',
    primaryDark: defaults.primaryDark || '#085044',
    primaryLight: defaults.primaryLight || '#E8F2EF',
  });

  // Apply colors live by updating CSS variables + Tailwind regenerated colors
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', tweaks.primary);
    root.style.setProperty('--primary-dark', tweaks.primaryDark);
    root.style.setProperty('--primary-light', tweaks.primaryLight);

    // Override tailwind utility classes that use bg-primary, text-primary, etc.
    let s = document.getElementById('tweak-overrides');
    if (!s) {
      s = document.createElement('style');
      s.id = 'tweak-overrides';
      document.head.appendChild(s);
    }
    s.textContent = `
      .bg-primary, .bg-primary-500 { background-color: ${tweaks.primary} !important; }
      .bg-primary-dark, .bg-primary-600 { background-color: ${tweaks.primaryDark} !important; }
      .bg-primary-light, .bg-primary-100 { background-color: ${tweaks.primaryLight} !important; }
      .bg-primary\\/5 { background-color: ${tweaks.primary}0d !important; }
      .bg-primary\\/10 { background-color: ${tweaks.primary}1a !important; }
      .bg-primary\\/15 { background-color: ${tweaks.primary}26 !important; }
      .bg-primary\\/20 { background-color: ${tweaks.primary}33 !important; }
      .text-primary, .text-primary-500 { color: ${tweaks.primary} !important; }
      .text-primary-dark, .text-primary-600 { color: ${tweaks.primaryDark} !important; }
      .border-primary { border-color: ${tweaks.primary} !important; }
      .border-primary\\/5 { border-color: ${tweaks.primary}0d !important; }
      .border-primary\\/10 { border-color: ${tweaks.primary}1a !important; }
      .border-primary\\/15 { border-color: ${tweaks.primary}26 !important; }
      .from-primary { --tw-gradient-from: ${tweaks.primary} !important; --tw-gradient-to: ${tweaks.primary}00 !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
      .to-primary-dark { --tw-gradient-to: ${tweaks.primaryDark} !important; }
      .hover\\:bg-primary:hover { background-color: ${tweaks.primary} !important; }
      .hover\\:text-primary:hover { color: ${tweaks.primary} !important; }
      .hover\\:border-primary:hover { border-color: ${tweaks.primary} !important; }
      .btn-primary { background-color: ${tweaks.primary} !important; }
      .btn-primary:hover { background-color: ${tweaks.primaryDark} !important; }
    `;
  }, [tweaks.primary, tweaks.primaryDark, tweaks.primaryLight]);

  const applyPreset = (p) => {
    setTweak({ primary: p.primary, primaryDark: p.dark, primaryLight: p.light });
  };

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Warna Primer" description="Variasi warna utama brand.">
        <div className="grid grid-cols-3 gap-2">
          {PRIMARY_PRESETS.map((p) => {
            const active = tweaks.primary.toLowerCase() === p.primary.toLowerCase();
            return (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="group relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition"
                style={{
                  borderColor: active ? p.primary : 'rgba(0,0,0,0.08)',
                  background: active ? p.primary + '12' : 'white',
                }}
                title={p.name}
              >
                <span
                  className="w-8 h-8 rounded-full ring-2 ring-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.dark})` }}
                />
                <span className="text-[10px] leading-tight text-center text-gray-600">{p.name}</span>
              </button>
            );
          })}
        </div>
      </TweakSection>

      <TweakSection title="Custom" description="Atur warna manual.">
        <TweakColor
          label="Primer"
          value={tweaks.primary}
          onChange={(v) => setTweak('primary', v)}
        />
        <TweakColor
          label="Primer Gelap"
          value={tweaks.primaryDark}
          onChange={(v) => setTweak('primaryDark', v)}
        />
        <TweakColor
          label="Primer Terang"
          value={tweaks.primaryLight}
          onChange={(v) => setTweak('primaryLight', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<TweaksApp />);
