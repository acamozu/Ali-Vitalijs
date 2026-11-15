import { Trash2, X, Undo2, Save, Plus, Pencil, Check, Bell, LayoutList, Menu, ListPlus, Download } from "lucide-react";
import LangSelect from "./LangSelect.jsx";
import { RULE_TYPES } from "./checks.js";
import { RuleRow } from "./RuleRow.jsx";
import logo from "../assets/alseda-logo.png";
import { WebIcon, LinkedInIcon } from "../SocialIcons.jsx";

// The fixed parts of the page: navbar, side menu, dialogs, layout bar and footer.
// They were part of CarpoolApp.jsx; the JSX is unchanged, every value comes in as a prop of the same name.

export function ConfirmRemove({ setDelAsk, t, byId, delAsk, removeNow }) {
  return (
    <div className="modal-backdrop" onClick={() => setDelAsk(null)}>
          <div className="modal confirm" role="alertdialog" aria-modal="true" aria-label={t.remove} onClick={(e) => e.stopPropagation()}>
            <h2>{t.removeAsk(byId[delAsk].name)}</h2>
            <div className="confirm-actions">
              <button className="ghost" onClick={() => setDelAsk(null)} autoFocus>{t.cancel}</button>
              <button className="ghost danger" onClick={removeNow}><Trash2 size={15} aria-hidden /> {t.remove}</button>
            </div>
          </div>
        </div>
  );
}

export function RulesModal({ setRulesOpen, t, addRule, rules, persons, teamList, changeRule, removeRule }) {
  return (
    <div className="modal-backdrop" onClick={() => setRulesOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={t.rulesH} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{t.rulesH}</h2>
              <button className="icon-btn" onClick={() => setRulesOpen(false)} aria-label={t.close} title={t.close}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="modal-scroll">
              <div className="rules-head">
                <p className="tile-note">{t.rulesSub}</p>
                <LangSelect
                  className="wide add-rule"
                  align="end"
                  noClear
                  value=""
                  placeholder={t.addRule}
                  label={t.addRule}
                  options={RULE_TYPES.map((k) => ({ value: k, label: t.ruleTypes[k] }))}
                  onValueChange={(v) => v && addRule(v)}
                />
              </div>
              {rules.length ? (
                <ul className="rule-list-edit">
                  {rules.map((r) => (
                    <RuleRow key={r.id} rule={r} persons={persons} teams={teamList} t={t} onChange={changeRule} onRemove={() => removeRule(r.id)} />
                  ))}
                </ul>
              ) : (
                <p className="rules-empty">{t.noRules}</p>
              )}
            </div>
          </div>
        </div>
  );
}

export function LayoutBar({ t, variants, renaming, renameVariant, setRenaming, activeId, applyVariant, layoutDirty, undoOrder, layoutPast, activeVariant, updateVariant, saveVariantAs, deleteVariant, setLayoutEdit }) {
  return (
    <div className="layout-bar" role="toolbar" aria-label={t.layoutH}>
          <div className="lb-variants" role="group" aria-label={t.variants}>
            {[{ id: null, name: t.defaultVariant }, ...variants].map((v) =>
              renaming && renaming === v.id ? (
                <input
                  key={v.id}
                  className="lb-rename"
                  defaultValue={v.name}
                  maxLength={24}
                  autoFocus
                  aria-label={t.rename}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => renameVariant(v.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  key={v.id ?? "default"}
                  className={activeId === v.id ? "on" : ""}
                  onClick={() => applyVariant(v.id)}
                  onDoubleClick={() => v.id && setRenaming(v.id)}
                  aria-pressed={activeId === v.id}
                >
                  {v.name}
                  {activeId === v.id && layoutDirty ? <i title={t.changed} /> : null}
                </button>
              )
            )}
          </div>
          <div className="lb-tools">
            <button className="lb-icon" onClick={undoOrder} disabled={!layoutPast.length} aria-label={t.undoOrder} title={t.undoOrder}>
              <Undo2 size={18} aria-hidden />
            </button>
            {activeVariant ? (
              <button className="lb-icon save" onClick={updateVariant} disabled={!layoutDirty} aria-label={t.save} title={t.save}>
                <Save size={18} aria-hidden />
              </button>
            ) : null}
            <button className="lb-icon" onClick={saveVariantAs} aria-label={t.newVariant} title={t.newVariant}>
              <Plus size={18} aria-hidden />
            </button>
            {activeVariant ? (
              <button className="lb-icon" onClick={() => setRenaming(activeVariant.id)} aria-label={t.rename} title={t.rename}>
                <Pencil size={17} aria-hidden />
              </button>
            ) : null}
            {activeVariant ? (
              <button className="lb-icon" onClick={deleteVariant} aria-label={t.deleteVariant} title={t.deleteVariant}>
                <Trash2 size={18} aria-hidden />
              </button>
            ) : null}
            <button className="lb-done" onClick={() => setLayoutEdit(false)}>
              <Check size={16} aria-hidden /> {t.done}
            </button>
          </div>
        </div>
  );
}

export function Navbar({ scrolled, t, sectionLinks, activeSec, checks, warns, layoutEdit, setLayoutEdit, lang, setLang, openDrawer }) {
  return (
    <header className={`cp-nav${scrolled ? " scrolled" : ""}`}>
        <img className="cp-logo" src={logo} alt="alseda Consulting" />
        <div className="cp-nav-right">
          <nav className="cp-nav-links" aria-label={t.goTo}>
            {sectionLinks.map((l) => (
              <a key={l.id} href={`#${l.id}`} className={activeSec === l.id ? "on" : ""}>
                {l.nav}
              </a>
            ))}
          </nav>
          <a className="cp-bell" href="#checks" aria-label={`${t.checksH}: ${checks.length}`} title={t.checksH}>
            <Bell size={18} aria-hidden />
            {checks.length ? <b className={warns ? "" : "calm"}>{checks.length}</b> : null}
          </a>
          <button className={`cp-layout-btn${layoutEdit ? " on" : ""}`} onClick={() => setLayoutEdit((o) => !o)} aria-pressed={layoutEdit}>
            <LayoutList size={16} aria-hidden /> <span>{t.layout}</span>
          </button>
          <div className="cp-lang" role="group" aria-label="Language">
            {["de", "en", "ru"].map((l) => (
              <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)} aria-pressed={l === lang}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="cp-menu-btn" onClick={openDrawer} aria-label={t.menu} aria-haspopup="dialog" title={t.menu}>
            <Menu size={20} aria-hidden />
          </button>
        </div>
      </header>
  );
}

export function Drawer({ drawerClosing, closeDrawer, t, sectionLinks, activeSec, setLayoutEdit, setRulesOpen, exportPlan, lang, setLang }) {
  return (
    <div className={`drawer-backdrop${drawerClosing ? " closing" : ""}`} onClick={() => closeDrawer()}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={t.menu} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <img className="drawer-logo" src={logo} alt="alseda Consulting" />
              <strong className="drawer-title">{t.plannerMenu}</strong>
              <button className="icon-btn" onClick={() => closeDrawer()} aria-label={t.close} title={t.close}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="drawer-scroll">
              <nav className="drawer-links" aria-label={t.goTo}>
                {sectionLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <a key={l.id} href={`#${l.id}`} className={activeSec === l.id ? "on" : ""} onClick={() => closeDrawer()}>
                      <Icon size={18} aria-hidden />
                      <span>{l.label}</span>
                      <b>{l.count}</b>
                    </a>
                  );
                })}
              </nav>
              <div className="drawer-actions">
                <button className="ghost" onClick={() => closeDrawer(() => setLayoutEdit(true))}>
                  <LayoutList size={16} aria-hidden /> {t.layout}
                </button>
                <button className="ghost" onClick={() => closeDrawer(() => setRulesOpen(true))}>
                  <ListPlus size={16} aria-hidden /> {t.rulesBtn}
                </button>
              </div>
              <button className="btn-grad drawer-export" onClick={() => closeDrawer(() => exportPlan())}>
                <Download size={16} aria-hidden /> {t.export}
              </button>
            </div>
            <div className="drawer-bottom">
              <div className="drawer-lang">
                <div className="cp-lang" role="group" aria-label="Language">
                  {["de", "en", "ru"].map((l) => (
                    <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)} aria-pressed={l === lang}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="drawer-foot">
                <span>© {new Date().getFullYear()} {t.rights}</span>
                <a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">
                  <WebIcon />
                </a>
                <a href="https://uk.linkedin.com/company/alseda-consulting" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
                  <LinkedInIcon />
                </a>
              </div>
            </div>
          </aside>
        </div>
  );
}

export function SiteFooter({ t }) {
  return (
    <footer className="tile cp-foot">
              <div className="foot-top">
                <div className="foot-brand">
                  <img className="cp-logo foot" src={logo} alt="alseda Consulting" />
                </div>
                <nav className="foot-links">
                  <a href="https://alseda.eu/" target="_blank" rel="noopener noreferrer" aria-label="alseda.eu" title="alseda.eu">
                    <WebIcon />
                  </a>
                  <a
                    href="https://uk.linkedin.com/company/alseda-consulting"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    title="LinkedIn"
                  >
                    <LinkedInIcon />
                  </a>
                </nav>
              </div>
              <div className="foot-bottom">
                <span>
                  © {new Date().getFullYear()} {t.rights}
                </span>
              </div>
            </footer>
  );
}
