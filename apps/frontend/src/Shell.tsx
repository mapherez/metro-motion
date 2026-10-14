import { Link, NavLink, Outlet } from 'react-router-dom';
import { lineNames } from '@metro/station-data';
import { LINE_LABEL, LINE_COLOR } from './format';
import { useSnapshotStore } from './state';

export function Shell() {
  const {snapshot,now,error,loading,connected,theme,toggleTheme,paused,togglePaused,reducedMotion}=useSnapshotStore();
  const freshest=snapshot?Math.max(0,...Object.values(snapshot.lines).map(l=>l.dataObservedAt??0)):0;
  const stale=!freshest||now-freshest>=30;
  const closed=snapshot?.serviceOpen===false;
  const status=closed?'Serviço encerrado':loading?'A ligar…':stale?'Sem dados atuais':connected?'Atualização em direto':'A restabelecer ligação';
  return <div className="app-shell">
    <a href="#main" className="skip-link">Saltar para o conteúdo</a>
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Metro Lisboa Live — início"><span className="brand-symbol" aria-hidden="true"><i/><i/><i/><i/></span><span>Metro Lisboa <strong>Live</strong></span></Link>
      <div className="header-tools">
        <span className={`connection-state ${closed?'closed':stale?'warning':'live'}`} role="status"><i aria-hidden="true"/>{status}</span>
        <button className="icon-button" onClick={toggleTheme} aria-label={theme==='dark'?'Ativar tema claro':'Ativar tema escuro'} title={theme==='dark'?'Tema claro':'Tema escuro'}>{theme==='dark'?'☀':'☾'}</button>
      </div>
    </header>
    <nav className="line-nav" aria-label="Linhas do Metro">
      {lineNames.map(line=><NavLink key={line} to={`/line/${line}`} className={({isActive})=>`line-link ${isActive?'active':''}`} style={{'--line-color':LINE_COLOR[line]} as React.CSSProperties}><span className="line-dot" aria-hidden="true"/>{LINE_LABEL[line]}</NavLink>)}
      <Link to="/about" className="about-link">Sobre</Link>
    </nav>
    {error&&<div className="connection-warning" role="status">{error}</div>}
    <main id="main" tabIndex={-1}><Outlet/></main>
    <footer className="app-footer"><span>Posições estimadas a partir dos tempos do Metro de Lisboa.</span><button className="text-button" onClick={togglePaused} aria-pressed={paused} disabled={reducedMotion}>{reducedMotion?'Movimento reduzido':paused?'Retomar animação':'Pausar animação'}</button></footer>
  </div>;
}
