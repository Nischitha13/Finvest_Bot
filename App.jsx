import React, { useState, useRef, useEffect } from 'react';
import './styles.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [activeFAQ, setActiveFAQ] = useState(null);
  const [toolResults, setToolResults] = useState({});
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your Finvest AI assistant. How can I help you with your investment questions today?",
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [navbarScrolled, setNavbarScrolled] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to format bot responses with markdown-like styling
  const formatBotResponse = (text) => {
    if (!text) return text;
    
    // Split text into lines for processing
    const lines = text.split('\n');
    const formattedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        formattedLines.push(<br key={i} />);
        continue;
      }
      
      // Handle bullet points (various formats)
      if (line.match(/^[-*•]\s/)) {
        const content = line.replace(/^[-*•]\s/, '');
        formattedLines.push(
          <div key={i} className="bullet-point">
            <span className="bullet">•</span>
            <span className="bullet-content">{formatInlineText(content)}</span>
          </div>
        );
      }
      // Handle numbered lists
      else if (line.match(/^\d+\.\s/)) {
        const content = line.replace(/^\d+\.\s/, '');
        const number = line.match(/^\d+/)[0];
        formattedLines.push(
          <div key={i} className="numbered-point">
            <span className="number">{number}.</span>
            <span className="number-content">{formatInlineText(content)}</span>
          </div>
        );
      }
      // Handle headers (lines that are short and end with colon or are standalone)
      else if (line.endsWith(':') && line.length < 50) {
        formattedLines.push(
          <div key={i} className="response-header">
            {formatInlineText(line)}
          </div>
        );
      }
      // Handle sub-bullets (indented with spaces or tabs)
      else if (line.match(/^\s+[-*•]\s/)) {
        const content = line.replace(/^\s+[-*•]\s/, '');
        formattedLines.push(
          <div key={i} className="sub-bullet-point">
            <span className="sub-bullet">◦</span>
            <span className="sub-bullet-content">{formatInlineText(content)}</span>
          </div>
        );
      }
      // Handle regular paragraphs
      else {
        formattedLines.push(
          <div key={i} className="response-paragraph">
            {formatInlineText(line)}
          </div>
        );
      }
    }
    
    return formattedLines;
  };

  // Function to format inline text (bold, italic, etc.)
  const formatInlineText = (text) => {
    if (!text) return text;
    
    // Handle bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle italic text *text*
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle code `text`
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Split by HTML tags and process
    const parts = text.split(/(<[^>]+>)/);
    return parts.map((part, index) => {
      if (part.startsWith('<')) {
        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      }
      return part;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleScroll = () => {
      setNavbarScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check for existing authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setAuthToken(token);
        setUser(JSON.parse(userData));
        setIsLoggedIn(true);
        
        // Clear chat messages when restoring user session
        setMessages([
          {
            id: 1,
            text: "Hello! I'm your Finvest AI assistant. How can I help you with your investment questions today?",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const sendMessage = async () => {
    if (inputMessage.trim()) {
      const userMessage = { 
        id: Date.now(),
        text: inputMessage, 
        sender: "user",
        timestamp: new Date().toLocaleTimeString()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputMessage("");
      setIsTyping(true);

      try {
        const response = await fetch("http://localhost:5001/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: inputMessage
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.answer || typeof data.answer !== "string") {
          throw new Error("Invalid response format");
        }

        const botReply = {
          id: Date.now() + 1,
          text: data.answer,
          sender: "bot",
          timestamp: new Date().toLocaleTimeString()
        };

        setMessages(prev => [...prev, botReply]);
      } catch (error) {
        console.error("Error fetching response:", error);
        const errorMessage = {
          id: Date.now() + 1,
          text: "Sorry, I couldn't process your request. Please try again.",
          sender: "bot",
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');
    
    const investmentId = e.target.querySelector('input[type="text"]').value;
    const password = e.target.querySelector('input[type="password"]').value;
    
    try {
      const response = await fetch("http://localhost:5001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Investment_ID: investmentId,
          password: password
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsLoggedIn(true);
        setUser(data.user);
        setAuthToken(data.token);
        setShowLoginPage(false);
        setAuthError('');
        
        // Clear chat messages for new user
        setMessages([
          {
            id: 1,
            text: "Hello! I'm your Finvest AI assistant. How can I help you with your investment questions today?",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
        
        // Store auth token in localStorage for persistence
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        setAuthError(data.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error("Login error:", error);
      setAuthError('Unable to connect to authentication service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setIsLoggedIn(true);
    setShowSignupModal(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setAuthToken(null);
    setShowChat(false);
    setShowLoginPage(false);
    setAuthError('');
    
    // Clear chat messages
    setMessages([
      {
        id: 1,
        text: "Hello! I'm your Finvest AI assistant. How can I help you with your investment questions today?",
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  const clearAuthError = () => {
    setAuthError('');
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFAQ = (index) => {
    setActiveFAQ(activeFAQ === index ? null : index);
  };

  const calculateSIP = async (monthlyInvestment, years, returnRate) => {
    try {
      const response = await fetch("http://localhost:5001/calculate/sip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_investment: monthlyInvestment,
          years: years,
          return_rate: returnRate
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setToolResults(prev => ({ ...prev, sip: data }));
    } catch (error) {
      console.error("Error calculating SIP:", error);
      setToolResults(prev => ({ ...prev, sip: { error: "Calculation failed. Please try again." } }));
    }
  };

  const calculateRetirement = async (goalAmount, years, returnRate) => {
    try {
      const response = await fetch("http://localhost:5001/calculate/retirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_amount: goalAmount,
          years: years,
          return_rate: returnRate
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setToolResults(prev => ({ ...prev, retirement: data }));
    } catch (error) {
      console.error("Error calculating retirement:", error);
      setToolResults(prev => ({ ...prev, retirement: { error: "Assessment failed. Please try again." } }));
    }
  };

  const assessRisk = async (timeHorizon, riskTolerance, comfortLevel) => {
    try {
      const response = await fetch("http://localhost:5001/assess/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_horizon: timeHorizon,
          risk_tolerance: riskTolerance,
          comfort_level: comfortLevel
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setToolResults(prev => ({ ...prev, risk: data }));
    } catch (error) {
      console.error("Error assessing risk:", error);
      setToolResults(prev => ({ ...prev, risk: { error: "Assessment failed. Please try again." } }));
    }
  };

  const handleToolSubmit = (toolType, formData) => {
    switch (toolType) {
      case 'sip':
        calculateSIP(formData.monthlyInvestment, formData.years, formData.returnRate);
        break;
      case 'retirement':
        calculateRetirement(formData.goalAmount, formData.years, formData.returnRate);
        break;
      case 'risk':
        assessRisk(formData.timeHorizon, formData.riskTolerance, formData.comfortLevel);
        break;
      default:
        break;
    }
  };

  const handleFundQuestion = async (fundName) => {
    setShowChat(true);
    // Add a message to the chat indicating which fund the user is asking about
    const fundMessage = {
      id: Date.now(),
      text: `I'm asking about the ${fundName}. Can you tell me more about this fund?`,
      sender: "user",
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, fundMessage]);
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:5001/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Tell me about the ${fundName} - its features, benefits, risk profile, and performance.`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.answer || typeof data.answer !== "string") {
        throw new Error("Invalid response format");
      }

      const botReply = {
        id: Date.now() + 1,
        text: data.answer,
        sender: "bot",
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, botReply]);
    } catch (error) {
      console.error("Error fetching response:", error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I couldn't process your request. Please try again.",
        sender: "bot",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="App">
      {/* Navigation Bar */}
      <nav className={`navbar ${navbarScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-text">Finvest</span>
          </div>
          <div className="nav-menu">
            <button onClick={() => scrollToSection('overview')}>Overview</button>
            <button onClick={() => scrollToSection('products')}>Products</button>
            <button onClick={() => scrollToSection('tools')}>Tools</button>
            <button onClick={() => scrollToSection('learn')}>Learn</button>
            <button onClick={() => scrollToSection('contact')}>Contact</button>
          </div>
          <div className="nav-auth">
            {!isLoggedIn ? (
              <button onClick={() => setShowLoginPage(true)} className="btn-secondary">Client Login</button>
            ) : (
              <div className="user-menu">
                <button onClick={handleLogout} className="btn-secondary">Logout</button>
                <span className="user-welcome">Welcome {user?.name || 'User'}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Invest with confidence.</h1>
          <p>AI-powered insights, goal-aligned portfolios, and expert guidance to help you build wealth for the future.</p>
          <div className="hero-buttons">
            {!isLoggedIn ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="btn-primary">Get Started</button>
                <button onClick={() => setShowLoginPage(true)} className="btn-secondary">Login</button>
              </>
            ) : (
              <button onClick={() => setShowChat(true)} className="btn-primary">Chat with AI</button>
            )}
          </div>
        </div>
        <div className="hero-background">
          <div className="grid-pattern"></div>
        </div>
      </section>

      {/* Overview Section */}
      <section id="overview" className="overview">
        <div className="container">
          <h2>Why Choose Finvest?</h2>
          <div className="value-props">
            <div className="value-card">
              <div className="card-icon">🛡️</div>
              <h3>Security & Compliance</h3>
              <p>Bank-level security with full regulatory compliance and transparent fee structures.</p>
            </div>
            <div className="value-card">
              <div className="card-icon">📈</div>
              <h3>Goal-Aligned Portfolios</h3>
              <p>Personalized investment strategies designed to match your financial goals and timeline.</p>
            </div>
            <div className="value-card">
              <div className="card-icon">⚡</div>
              <h3>Smart AI Assistant</h3>
              <p>24/7 AI-powered guidance to answer your investment questions and provide insights.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Wealth Management Services Section */}
      <section className="wealth-management">
        <div className="container">
          <div className="wealth-content">
            <div className="wealth-text">
              <h2>Our Wealth Management Services</h2>
              <p>We provide a tailored approach to investment management and financial planning that puts our clients first. This starts with a comprehensive assessment of your financial situation that informs your investment strategy and considers important factors outside of your portfolio. If you already own investments such as annuities, Finvest can discuss and provide information about them to help determine if they make sense for your investment goals. This results in a personalized investing approach consistent with your goals and needs.</p>
              <button className="btn-primary">Explore All Services</button>
            </div>
            <div className="wealth-image">
              <div className="image-placeholder">
                <img 
                  src={require('./images/inv1.jpg')} 
                  alt="Professional Wealth Management Team" 
                  className="wealth-team-image"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="products">
        <div className="container">
          <h2>Investment Products</h2>
          <div className="product-grid">
            <div className="product-card">
              <div className="product-header">
                <h3>Emerging Markets Fund</h3>
              </div>
              <div className="product-actions">
                <button onClick={() => isLoggedIn ? handleFundQuestion('Emerging Markets Fund') : setShowLoginPage(true)} className="btn-primary">Ask Bot</button>
              </div>
            </div>
            <div className="product-card">
              <div className="product-header">
                <h3>Global Equity Fund</h3>
              </div>
              <div className="product-actions">
                <button onClick={() => isLoggedIn ? handleFundQuestion('Global Equity Fund') : setShowLoginPage(true)} className="btn-primary">Ask Bot</button>
              </div>
            </div>
            <div className="product-card">
              <div className="product-header">
                <h3>Government Bond Fund</h3>
              </div>
              <div className="product-actions">
                <button onClick={() => isLoggedIn ? handleFundQuestion('Government Bond Fund') : setShowLoginPage(true)} className="btn-primary">Ask Bot</button>
              </div>
            </div>
            <div className="product-card">
              <div className="product-header">
                <h3>Sustainable Future Fund</h3>
              </div>
              <div className="product-actions">
                <button onClick={() => isLoggedIn ? handleFundQuestion('Sustainable Future Fund') : setShowLoginPage(true)} className="btn-primary">Ask Bot</button>
              </div>
            </div>
            <div className="product-card">
              <div className="product-header">
                <h3>Balanced Growth Fund</h3>
              </div>
              <div className="product-actions">
                <button onClick={() => isLoggedIn ? handleFundQuestion('Balanced Growth Fund') : setShowLoginPage(true)} className="btn-primary">Ask Bot</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="tools">
        <div className="container">
          <h2>Investment Tools</h2>
          <div className="tools-grid">
            <div className="tool-card">
              <h3>SIP Calculator</h3>
              <div className="tool-inputs">
                <input type="number" placeholder="Monthly Investment" id="sip-monthly" />
                <input type="number" placeholder="Years" id="sip-years" />
                <input type="number" placeholder="Return Rate %" id="sip-return" />
              </div>
              <button 
                className="btn-primary"
                onClick={() => {
                  const monthly = document.getElementById('sip-monthly').value;
                  const years = document.getElementById('sip-years').value;
                  const returnRate = document.getElementById('sip-return').value;
                  if (monthly && years && returnRate) {
                    handleToolSubmit('sip', { monthlyInvestment: monthly, years: years, returnRate: returnRate });
                  }
                }}
              >
                Calculate
              </button>
              {toolResults.sip && (
                <div className="tool-results">
                  {toolResults.sip.error ? (
                    <p className="error">{toolResults.sip.error}</p>
                  ) : (
                    <div>
                      <p><strong>Total Investment:</strong> ${toolResults.sip.total_investment?.toLocaleString()}</p>
                      <p><strong>Future Value:</strong> ${toolResults.sip.future_value?.toLocaleString()}</p>
                      <p><strong>Total Return:</strong> ${toolResults.sip.total_return?.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="tool-card">
              <h3>Retirement Estimator</h3>
              <div className="tool-inputs">
                <input type="number" placeholder="Goal Amount" id="retirement-goal" />
                <input type="number" placeholder="Years" id="retirement-years" />
                <input type="number" placeholder="Return Rate %" id="retirement-return" />
              </div>
              <button 
                className="btn-primary"
                onClick={() => {
                  const goal = document.getElementById('retirement-goal').value;
                  const years = document.getElementById('retirement-years').value;
                  const returnRate = document.getElementById('retirement-return').value;
                  if (goal && years && returnRate) {
                    handleToolSubmit('retirement', { goalAmount: goal, years: years, returnRate: returnRate });
                  }
                }}
              >
                Calculate
              </button>
              {toolResults.retirement && (
                <div className="tool-results">
                  {toolResults.retirement.error ? (
                    <p className="error">{toolResults.retirement.error}</p>
                  ) : (
                    <div>
                      <p><strong>Monthly Investment Needed:</strong> ${toolResults.retirement.monthly_investment_needed?.toLocaleString()}</p>
                      <p><strong>Total Investment:</strong> ${toolResults.retirement.total_investment?.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="tool-card">
              <h3>Risk Assessment</h3>
              <div className="tool-inputs">
                <select id="risk-time">
                  <option value="">Time Horizon</option>
                  <option value="Short-term (1-3 years)">Short-term (1-3 years)</option>
                  <option value="Medium-term (3-10 years)">Medium-term (3-10 years)</option>
                  <option value="Long-term (10+ years)">Long-term (10+ years)</option>
                </select>
                <select id="risk-tolerance">
                  <option value="">Risk Tolerance</option>
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
                <select id="risk-comfort">
                  <option value="">Comfort Level</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <button 
                className="btn-primary"
                onClick={() => {
                  const time = document.getElementById('risk-time').value;
                  const tolerance = document.getElementById('risk-tolerance').value;
                  const comfort = document.getElementById('risk-comfort').value;
                  if (time && tolerance && comfort) {
                    handleToolSubmit('risk', { timeHorizon: time, riskTolerance: tolerance, comfortLevel: comfort });
                  }
                }}
              >
                Assess
              </button>
              {toolResults.risk && (
                <div className="tool-results">
                  {toolResults.risk.error ? (
                    <p className="error">{toolResults.risk.error}</p>
                  ) : (
                    <div>
                      <p><strong>Risk Profile:</strong> {toolResults.risk.risk_profile}</p>
                      <p><strong>Recommendation:</strong> {toolResults.risk.recommendation}</p>
                      <p><strong>Max Equity Allocation:</strong> {toolResults.risk.max_equity_allocation}%</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Learning Center */}
      <section id="learn" className="learn">
        <div className="container">
          <h2>Learning Center</h2>
          <div className="faq-container">
            <div className={`faq-item ${activeFAQ === 0 ? 'active' : ''}`}>
              <div className="faq-question" onClick={() => toggleFAQ(0)}>
                <h3>What is NAV?</h3>
                <span className="faq-toggle">{activeFAQ === 0 ? '−' : '+'}</span>
              </div>
              <div className="faq-answer">
                <p>Net Asset Value (NAV) represents the per-share value of a mutual fund, calculated by dividing the total value of all securities in the portfolio by the number of outstanding shares.</p>
              </div>
            </div>
            <div className={`faq-item ${activeFAQ === 1 ? 'active' : ''}`}>
              <div className="faq-question" onClick={() => toggleFAQ(1)}>
                <h3>What is TER?</h3>
                <span className="faq-toggle">{activeFAQ === 1 ? '−' : '+'}</span>
              </div>
              <div className="faq-answer">
                <p>Total Expense Ratio (TER) is the annual fee charged by mutual funds to cover operating expenses, including management fees, administrative costs, and other operational expenses.</p>
              </div>
            </div>
            <div className={`faq-item ${activeFAQ === 2 ? 'active' : ''}`}>
              <div className="faq-question" onClick={() => toggleFAQ(2)}>
                <h3>What is Diversification?</h3>
                <span className="faq-toggle">{activeFAQ === 2 ? '−' : '+'}</span>
              </div>
              <div className="faq-answer">
                <p>Diversification is an investment strategy that spreads your money across different asset classes, sectors, and geographic regions to reduce risk and potentially improve returns.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        <div className="container">
          <h2>Contact Us</h2>
          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-icon">📧</div>
              <h3>Email</h3>
              <p>support@finvest.com</p>
            </div>
            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <h3>Phone</h3>
              <p>+1 (555) 123-4567</p>
            </div>
            <div className="contact-card">
              <div className="contact-icon">📍</div>
              <h3>Address</h3>
              <p>123 Financial District<br />New York, NY 10001</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-column">
              <h3>About Finvest</h3>
              <ul>
                <li>The Finvest Difference</li>
                <li>Our Story</li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Personal Wealth Management</h3>
              <ul>
                <li>Your Financial Goals</li>
                <li>How We Help You</li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Investment Services</h3>
              <ul>
                <li>Investment Products</li>
                <li>Portfolio Management</li>
                <li>Financial Planning</li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Contact Us</h3>
              <ul>
                <li>Find a Location</li>
                <li>Find a Representative</li>
                <li>Press Inquiries</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Page */}
      {showLoginPage && (
        <div className="login-page">
          <div className="login-container">
            <div className="login-header">
              <h1>Client Login</h1>
              <p>Access your Finvest investment portfolio</p>
            </div>
            <form onSubmit={handleLogin} className="login-form">
              {authError && (
                <div className="error-message">
                  {authError}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="Investment_ID">Investment ID</label>
                <input 
                  type="text" 
                  id="Investment_ID"
                  placeholder="Enter your Investment ID" 
                  required 
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input 
                  type="password" 
                  id="password"
                  placeholder="Enter your password" 
                  required 
                  disabled={isLoading}
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary login-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
              <button 
                type="button" 
                onClick={() => { setShowLoginPage(false); clearAuthError(); }} 
                className="btn-secondary back-btn"
                disabled={isLoading}
              >
                Back to Home
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Bot */}
      {showChat && isLoggedIn && (
        <div className="chat-overlay" onClick={() => setShowChat(false)}>
          <div className="chat-container" onClick={(e) => e.stopPropagation()} ref={chatContainerRef}>
            <div className="chat-header">
              <h3>🤖 Finvest AI Assistant</h3>
              <button onClick={() => setShowChat(false)} className="close-btn">×</button>
            </div>
            
            <div className="messages-container">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
                >
                  <div className="message-content">
                    {message.sender === 'bot' ? (
                      <div className="formatted-response">
                        {formatBotResponse(message.text)}
                      </div>
                    ) : (
                      <p>{message.text}</p>
                    )}
                    <span className="timestamp">{message.timestamp}</span>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="message bot-message">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            <div className="input-container">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about investments, products, or tools..."
                className="message-input"
              />
              <button
                onClick={sendMessage}
                disabled={inputMessage.trim() === ''}
                className="send-button"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Signup Modal */}
      {showSignupModal && (
        <div className="modal-overlay" onClick={() => setShowSignupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Account</h2>
            <form onSubmit={handleSignup}>
              <input type="text" placeholder="Full Name" required />
              <input type="email" placeholder="Email" required />
              <input type="password" placeholder="Password" required />
              <input type="password" placeholder="Confirm Password" required />
              <button type="submit" className="btn-primary">Sign Up</button>
            </form>
            <button onClick={() => setShowSignupModal(false)} className="close-btn">×</button>
          </div>
        </div>
      )}

      {/* Chat Toggle Button - Only show for logged-in users */}
      {isLoggedIn && (
        <button 
          className="chat-toggle-btn"
          onClick={() => setShowChat(!showChat)}
          aria-label="Open AI Chat Assistant"
        >
        </button>
      )}
    </div>
  );
}

export default App;
