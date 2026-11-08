import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Users,
  Settings2,
  Wifi,
  Radio,
} from 'lucide-react';

export default function ConnectionModal({
  isOpen,
  onClose,
  roomId = 'TKD-1',
  serverIp = '127.0.0.1',
  serverPort = 5173,
  activeJudges = [],
  consensusRequired = 2,
  onUpdateConsensus,
}) {
  const [activeTab, setActiveTab] = useState('operator');
  const [copied, setCopied] = useState(false);
  const [customIp, setCustomIp] = useState('');
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [lanIp, setLanIp] = useState('');
  const [lanPort, setLanPort] = useState(5173);

  // Fetch real LAN IP from server so phones on same Wi-Fi can scan QR and connect
  useEffect(() => {
    let cancelled = false;
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.localIp) {
          setLanIp(data.localIp);
          if (data.port) setLanPort(Number(data.port));
        }
      })
      .catch(() => {
        // Ignore - fallback to currentOrigin below
      });
    return () => { cancelled = true; };
  }, []);

  if (!isOpen) return null;

  // Determine host to use for QR code
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // If local, prefer the detected LAN IP address (e.g. 192.168.1.6)
  const hostToUse = customIp
    ? `http://${customIp}`
    : isLocalhost && lanIp
    ? `http://${lanIp}:${lanPort}`
    : isLocalhost && serverIp && serverIp !== '127.0.0.1'
    ? `http://${serverIp}:${serverPort}`
    : currentOrigin;

  // Generate URLs for different roles
  const getUrlForRole = (role, slot = null) => {
    const params = new URLSearchParams({
      room: roomId,
      role,
    });
    if (slot !== null) {
      params.set('slot', String(slot));
    }
    return `${hostToUse}/?${params.toString()}`;
  };

  const getTargetUrl = () => {
    switch (activeTab) {
      case 'operator':
        return getUrlForRole('operator');
      case 'judge1':
        return getUrlForRole('judge', 1);
      case 'judge2':
        return getUrlForRole('judge', 2);
      case 'judge3':
        return getUrlForRole('judge', 3);
      case 'spectator':
        return getUrlForRole('spectator');
      default:
        return getUrlForRole('operator');
    }
  };

  const targetUrl = getTargetUrl();

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = () => {
    window.open(targetUrl, '_blank');
  };

  const isSlotConnected = (slot) => {
    return activeJudges.some((j) => j.slot === slot && j.online);
  };

  const getJudgeName = (slot) => {
    const found = activeJudges.find((j) => j.slot === slot);
    return found ? found.name : `Hakem ${slot}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Radio className="icon-pulse text-cyan" size={24} />
            <h2>QR Kod ile Telefon & Hakem Bağlantısı</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* IP and Network status banner */}
        <div className="network-banner">
          <div className="network-info">
            <Wifi size={16} className="text-cyan" />
            <span>
              Ağ Bağlantısı:{' '}
              <strong>
                {customIp || (isLocalhost && lanIp ? `${lanIp}:${lanPort}` : (serverIp && serverIp !== '127.0.0.1' ? `${serverIp}:${serverPort}` : window.location.host))}
              </strong>
            </span>
          </div>
          <button className="btn-text" onClick={() => setIsEditingIp(!isEditingIp)}>
            {isEditingIp ? 'Kaydet' : 'IP Değiştir'}
          </button>
        </div>

        {isEditingIp && (
          <div className="ip-edit-box">
            <label>Özel IP / Hostname (ör: 192.168.1.6:5173 veya ngrok adresi):</label>
            <div className="ip-input-row">
              <input
                type="text"
                placeholder={`${serverIp}:${serverPort}`}
                value={customIp}
                onChange={(e) => setCustomIp(e.target.value)}
              />
              <button className="btn-small" onClick={() => setIsEditingIp(false)}>
                Tamam
              </button>
            </div>
            <p className="hint-text">
              Telefonunuzun bu bilgisayarla aynı Wi-Fi ağına bağlı olduğundan emin olun.
            </p>
          </div>
        )}

        {/* Tab selection */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'operator' ? 'active' : ''}`}
            onClick={() => setActiveTab('operator')}
          >
            <Smartphone size={16} />
            <span>Masa Kumandası</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'judge1' ? 'active' : ''}`}
            onClick={() => setActiveTab('judge1')}
          >
            <span className={`status-dot ${isSlotConnected(1) ? 'connected' : ''}`} />
            <span>Hakem 1 (J1)</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'judge2' ? 'active' : ''}`}
            onClick={() => setActiveTab('judge2')}
          >
            <span className={`status-dot ${isSlotConnected(2) ? 'connected' : ''}`} />
            <span>Hakem 2 (J2)</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'judge3' ? 'active' : ''}`}
            onClick={() => setActiveTab('judge3')}
          >
            <span className={`status-dot ${isSlotConnected(3) ? 'connected' : ''}`} />
            <span>Hakem 3 (J3)</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'judges_list' ? 'active' : ''}`}
            onClick={() => setActiveTab('judges_list')}
          >
            <Users size={16} />
            <span>Hakem Yönetimi</span>
          </button>
        </div>

        {/* Tab Body */}
        {activeTab !== 'judges_list' ? (
          <div className="qr-container">
            <div className="qr-card">
              <div className="qr-frame">
                <QRCodeSVG
                  value={targetUrl}
                  size={220}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0a0c16"
                />
              </div>

              <div className="qr-info">
                <h3>
                  {activeTab === 'operator' && '📱 Masa Hakemi / Genel Kumanda'}
                  {activeTab === 'judge1' && '🥋 Köşe Hakemi 1 Padi'}
                  {activeTab === 'judge2' && '🥋 Köşe Hakemi 2 Padi'}
                  {activeTab === 'judge3' && '🥋 Köşe Hakemi 3 Padi'}
                  {activeTab === 'spectator' && '👁️ Canlı Seyirci Ekranı'}
                </h3>
                <p>
                  Telefonunuzun kamerasını açarak QR kodu okutun. Herhangi bir uygulama yüklemenize
                  gerek yoktur!
                </p>

                <div className="status-pill">
                  {activeTab === 'operator' ? (
                    <span className="badge-ok">Tam Kontrol Yetkisi (Süre, Skor, Ceza)</span>
                  ) : (
                    <span className={isSlotConnected(Number(activeTab.replace('judge', ''))) ? 'badge-ok' : 'badge-wait'}>
                      {isSlotConnected(Number(activeTab.replace('judge', '')))
                        ? `🟢 Bağlı: ${getJudgeName(Number(activeTab.replace('judge', '')))}`
                        : '⚪ Bağlantı Bekleniyor...'}
                    </span>
                  )}
                </div>

                <div className="url-copy-box">
                  <input type="text" readOnly value={targetUrl} />
                  <button className="btn-copy" onClick={handleCopy} title="Linki Kopyala">
                    {copied ? <Check size={18} className="text-green" /> : <Copy size={18} />}
                  </button>
                  <button
                    className="btn-open"
                    onClick={handleOpenNewTab}
                    title="Yeni Sekmede Aç (Test)"
                  >
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Hakem Yönetimi & Konsensüs */
          <div className="judges-manage-pane">
            <div className="judge-card-grid">
              {[1, 2, 3].map((slot) => {
                const connected = isSlotConnected(slot);
                const name = getJudgeName(slot);
                return (
                  <div key={slot} className={`judge-card ${connected ? 'is-online' : ''}`}>
                    <div className="judge-card-header">
                      <span className="judge-badge">Köşe Hakemi {slot}</span>
                      <span className={`status-indicator ${connected ? 'online' : 'offline'}`}>
                        {connected ? '● Bağlı' : '○ Çevrimdışı'}
                      </span>
                    </div>
                    <div className="judge-card-body">
                      <h4>{name}</h4>
                      <p>{connected ? 'Puanlama yapmaya hazır' : 'QR kod ile bağlanması bekleniyor'}</p>
                    </div>
                    <button
                      className="btn-small btn-secondary"
                      onClick={() => setActiveTab(`judge${slot}`)}
                    >
                      QR Kodu Göster
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="consensus-config-box">
              <div className="consensus-title">
                <Settings2 size={18} className="text-cyan" />
                <h4>Hakem Puan Uzlaşısı (Consensus) Kuralı</h4>
              </div>
              <p className="text-muted">
                WT resmi kurallarına göre bir vuruşun puan sayılması için birden fazla hakemin aynı
                vuruşa basması gerekir.
              </p>

              <div className="consensus-options">
                <label className={`option-label ${consensusRequired === 1 ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="consensus"
                    checked={consensusRequired === 1}
                    onChange={() => onUpdateConsensus(1)}
                  />
                  <div>
                    <strong>Doğrudan Puan (1 Hakem)</strong>
                    <p>Herhangi bir hakem bastığı anda puan derhal skora eklenir (Antrenman modu).</p>
                  </div>
                </label>

                <label className={`option-label ${consensusRequired === 2 ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="consensus"
                    checked={consensusRequired === 2}
                    onChange={() => onUpdateConsensus(2)}
                  />
                  <div>
                    <strong>WT Uzlaşı Modu (3 Hakemden En Az 2&apos;si)</strong>
                    <p>
                      1.2 saniye içinde en az 2 hakem aynı puana bastığında puan onaylanır ve skora
                      yansır (Resmi WT Kuralı).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <div className="room-badge">
            Oda Kodu: <strong>{roomId}</strong>
          </div>
          <button className="btn-primary" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

