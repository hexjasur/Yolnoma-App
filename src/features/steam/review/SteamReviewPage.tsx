import { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

const reviewData = [
  {
    id: 'graphics',
    title: 'Graphics',
    options: [
      'You forget what reality is',
      'Beautiful',
      'Good',
      'Decent',
      'Bad',
      "Don't look too long at it",
      'MS-DOS',
    ],
  },
  {
    id: 'gameplay',
    title: 'Gameplay',
    options: [
      'Very good',
      'Good',
      "It's just gameplay",
      'Mehh',
      'Watch paint dry instead',
      "Just don't",
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    options: [
      'Eargasm',
      'Very good',
      'Good',
      'Not too bad',
      'Bad',
      "I'm now deaf",
    ],
  },
  {
    id: 'audience',
    title: 'Audience',
    options: ['Kids', 'Teens', 'Adults', 'Grandpa'],
  },
  {
    id: 'requirements',
    title: 'PC Requirements',
    options: [
      'Check if you can run paint',
      'Potato',
      'Decent',
      'Fast',
      'Rich boi',
      'Ask NASA if they have a spare computer',
    ],
  },
  {
    id: 'size',
    title: 'Game Size',
    options: [
      'Floppy Disk (0-50MB)',
      'CD (50-700MB)',
      'DVD (700MB-4GB)',
      'Normal (4GB-20GB)',
      'Big (20GB-100GB)',
      'Huge (100GB+)',
    ],
  },
  {
    id: 'difficulty',
    title: 'Difficulty',
    options: [
      "Just press 'W'",
      'Easy',
      'Easy to learn / Hard to master',
      'Significant brain usage',
      'Difficult',
      'Dark Souls',
    ],
  },
  {
    id: 'grind',
    title: 'Grind',
    options: [
      'Nothing to grind',
      'Only if u care about leaderboards/ranks',
      "Isn't necessary to progress",
      'Average grind level',
      'Too much grind',
      "You'll need a second life for grinding",
    ],
  },
  {
    id: 'story',
    title: 'Story',
    options: [
      'No Story',
      'Some lore',
      'Average',
      'Good',
      'Lovely',
      "It'll replace your life",
    ],
  },
  {
    id: 'gametime',
    title: 'Game Time',
    options: [
      'Long enough for a cup of coffee',
      'Short',
      'Average',
      'Long',
      'To infinity and beyond',
    ],
  },
  {
    id: 'price',
    title: 'Price',
    options: [
      "It's free!",
      'Worth the price',
      "If it's on sale",
      'If u have some spare money left',
      'Not recommended',
      'You could also just burn your money',
    ],
  },
  {
    id: 'bugs',
    title: 'Bugs',
    options: [
      'Never heard of',
      'Minor bugs',
      'Can get annoying',
      'ARK: Survival Evolved',
      'The game itself is a big terrarium for bugs',
    ],
  },
  {
    id: 'rating',
    title: 'Rating ?/10',
    options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
];

export default function SteamReviewPage() {
  const [selections, setSelections] = useState<Record<string, Set<number>>>(
    () => {
      const initial: Record<string, Set<number>> = {};
      reviewData.forEach((cat) => (initial[cat.id] = new Set()));
      return initial;
    },
  );
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    new Set(),
  );
  const [showToast, setShowToast] = useState(false);

  const previewText = useMemo(() => {
    let output = '';
    const checkedBox = '☑';
    const uncheckedBox = '☐';

    const visibleCategories = reviewData.filter(
      (cat) => !hiddenCategories.has(cat.id),
    );

    visibleCategories.forEach((category, catIndex) => {
      output += `---{ ${category.title} }---\n`;

      category.options.forEach((option, optIndex) => {
        const isSelected = selections[category.id]?.has(optIndex);
        const box = isSelected ? checkedBox : uncheckedBox;
        output += `${box} ${option}\n`;
      });

      if (catIndex < visibleCategories.length - 1) {
        output += '\n';
      }
    });

    if (visibleCategories.length > 0) {
      output += '\n\n';
    }
    output += `---{ Author }---\nhttps://steamcommunity.com/id/ROCKSTAR_TTV`;

    return output;
  }, [selections, hiddenCategories]);

  const handleCheckboxChange = (categoryId: string, index: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      const newSet = new Set(next[categoryId] || []);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      next[categoryId] = newSet;
      return next;
    });
  };

  const toggleVisibility = (categoryId: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleReset = () => {
    const initial: Record<string, Set<number>> = {};
    reviewData.forEach((cat) => (initial[cat.id] = new Set()));
    setSelections(initial);
    setHiddenCategories(new Set());
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(previewText)
      .then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <div className="min-h-screen text-[#F2EDE6] font-sans antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `
                .steam-checkbox {
                    appearance: none;
                    background-color: #14110E;
                    margin: 0;
                    font: inherit;
                    width: 1.05em;
                    height: 1.05em;
                    border: 1px solid rgba(242,237,230,0.18);
                    border-radius: 0.3em;
                    display: grid;
                    place-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease-in-out;
                    flex-shrink: 0;
                }
                .steam-checkbox::before {
                    content: "";
                    width: 0.62em;
                    height: 0.62em;
                    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
                    transform: scale(0);
                    transform-origin: bottom left;
                    transition: 120ms transform ease-in-out;
                    background-color: white;
                }
                .steam-checkbox:checked {
                    background-color: #D97757;
                    border-color: #D97757;
                }
                .steam-checkbox:checked::before { transform: scale(1); }
                .steam-checkbox:hover { border-color: #D97757; }

                @keyframes toast-pop {
                  from { opacity: 0; transform: translate(-50%, 6px); }
                  to { opacity: 1; transform: translate(-50%, 0); }
                }
                .toast-pop { animation: toast-pop 160ms ease-out; }
                `,
        }}
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto w-full px-6 pb-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D97757]">
                Steam Toolkit
              </p>
              <h1 className="text-2xl font-medium tracking-tight text-[#F2EDE6]">
                Steam Review Generator
              </h1>
              <p className="mt-1 text-[13px] text-white/45">
                Community review format
              </p>
            </div>
          </div>

          <a
            href="https://github.com/hexjasur/steam-review-generator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start text-xs text-white/40 transition-colors hover:text-[#F2EDE6] sm:self-auto"
          >
            <ExternalLink size={15} strokeWidth={1.75} />
            Source
          </a>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-6">
        {/* Categories grid */}
        <div className="w-full lg:w-2/3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewData.map((category) => {
              const isHidden = hiddenCategories.has(category.id);
              const isRating = category.id === 'rating';

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-white/[0.08] bg-[#181410] p-4 flex flex-col
                             transition-colors duration-150 hover:border-[#D97757]/30"
                >
                  <div className="mb-3 flex justify-between items-center">
                    <h3 className="text-[#F2EDE6] font-medium text-[13px] tracking-wide">
                      {category.title}
                    </h3>
                    <button
                      onClick={() => toggleVisibility(category.id)}
                      className={`p-1 rounded transition-colors ${
                        isHidden
                          ? 'text-white/20 hover:text-white/40'
                          : 'text-white/35 hover:text-[#D97757]'
                      }`}
                      title="Toggle category visibility"
                    >
                      {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div
                    className={`transition-opacity duration-150 ${
                      isHidden ? 'opacity-25 pointer-events-none' : ''
                    }`}
                  >
                    {isRating ? (
                      <div className="grid grid-cols-5 gap-1.5">
                        {category.options.map((option, index) => {
                          const isChecked =
                            selections[category.id]?.has(index) || false;
                          return (
                            <button
                              key={`${category.id}-${index}`}
                              type="button"
                              onClick={() =>
                                handleCheckboxChange(category.id, index)
                              }
                              className={`h-8 rounded-md text-xs font-medium border transition-colors ${
                                isChecked
                                  ? 'bg-[#D97757]/15 border-[#D97757]/50 text-[#D97757]'
                                  : 'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {category.options.map((option, index) => {
                          const isChecked =
                            selections[category.id]?.has(index) || false;
                          return (
                            <label
                              key={`${category.id}-${index}`}
                              className="flex items-center gap-2.5 cursor-pointer rounded-md px-1.5 py-1.5 -mx-1.5
                                         transition-colors hover:bg-white/[0.04]"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  handleCheckboxChange(category.id, index)
                                }
                                className="steam-checkbox"
                              />
                              <span
                                className={`text-[13px] leading-tight transition-colors ${
                                  isChecked ? 'text-[#F2EDE6]' : 'text-white/50'
                                }`}
                              >
                                {option}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview panel */}
        <div className="w-full lg:w-1/3 lg:sticky lg:top-24 self-start">
          <div className="rounded-xl border border-white/[0.08] bg-[#181410] flex flex-col h-[calc(100vh-8rem)] min-h-[500px] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.08] flex items-center gap-2">
              <Eye className="text-[#D97757]" size={16} strokeWidth={1.75} />
              <h2 className="text-[13px] font-semibold text-[#F2EDE6] uppercase tracking-wider">
                Preview
              </h2>
            </div>

            <div className="flex-grow p-3 overflow-hidden">
              <textarea
                value={previewText}
                readOnly
                className="w-full h-full text-[#F2EDE6]/85 font-mono text-[12.5px] leading-5 p-3.5 rounded-lg
                           border border-white/[0.06] focus:outline-none focus:border-[#D97757]/40
                           resize-none overflow-y-auto whitespace-pre-wrap"
                style={{ background: '#0F0D0B' }}
              />
            </div>

            <div className="p-3.5 border-t border-white/[0.08] flex flex-col gap-2 relative">
              <button
                onClick={handleCopy}
                className="w-full bg-[#D97757] hover:bg-[#D97757]/90 text-white font-semibold py-2.5 px-4 rounded-lg
                           transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Copy size={15} strokeWidth={2} />
                Copy to Clipboard
              </button>
              <button
                onClick={handleReset}
                className="w-full bg-white/[0.04] hover:bg-white/[0.07] text-white/60 hover:text-[#F2EDE6] font-medium
                           py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm
                           border border-white/[0.08]"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                Reset Selections
              </button>

              {showToast && (
                <div
                  className="toast-pop absolute -top-11 left-1/2 flex items-center gap-2 px-3.5 py-2 rounded-lg
                             bg-[#181410] border border-[#D97757]/35 text-[#D97757] text-xs font-medium shadow-xl"
                  style={{ boxShadow: '0 12px 30px -8px rgba(0,0,0,0.6)' }}
                >
                  <CheckCircle2 size={13} />
                  Copied to clipboard
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
