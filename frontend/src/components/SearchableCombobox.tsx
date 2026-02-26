import React from 'react';

interface SearchableComboboxProps {
  id?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'Search...',
  emptyText = 'No results',
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listId = React.useMemo(() => `${id || 'combo'}-listbox`, [id]);

  const filtered = React.useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) {
      return options.slice(0, 100);
    }
    return options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 100);
  }, [options, value]);

  React.useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }
    if (filtered.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => {
      if (current < 0 || current >= filtered.length) {
        return 0;
      }
      return current;
    });
  }, [filtered, isOpen]);

  const applyValue = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div className={`combobox ${className}`.trim()}>
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen}
        className="field-input combobox__input"
        id={id}
        ref={inputRef}
        onBlur={() => {
          window.setTimeout(() => {
            setIsOpen(false);
          }, 120);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            if (filtered.length > 0) {
              setActiveIndex((current) => (current + 1) % filtered.length);
            }
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
            if (filtered.length > 0) {
              setActiveIndex((current) => (current <= 0 ? filtered.length - 1 : current - 1));
            }
            return;
          }
          if (event.key === 'Enter' && isOpen && activeIndex >= 0 && activeIndex < filtered.length) {
            event.preventDefault();
            applyValue(filtered[activeIndex]);
            return;
          }
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        value={value}
      />
      {value.trim().length > 0 && (
        <button
          aria-label="Clear input"
          className="combobox__clear"
          onClick={() => {
            onChange('');
            setIsOpen(true);
            inputRef.current?.focus();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          type="button"
        >
          x
        </button>
      )}

      {isOpen && (
        <ul className="combobox__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li aria-disabled="true" className="combobox__item combobox__item--empty" role="option">
              {emptyText}
            </li>
          ) : (
            filtered.map((option, index) => (
              <li
                aria-selected={index === activeIndex}
                className={`combobox__item ${index === activeIndex ? 'combobox__item--active' : ''}`}
                key={option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyValue(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                {option}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableCombobox;

