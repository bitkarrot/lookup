/**
 * Client-side Zap Integration for Directory Entries
 * Handles NIP-57 zap payments for directory submissions
 */

import { createDirectoryZapRequest, PAYMENT_CONFIG } from './directory-schema.js';

/**
 * Main class for handling zap payments for directory entries
 */
export class DirectoryZapHandler {
  constructor(relayUrl = PAYMENT_CONFIG.RELAYS[0]) {
    this.relayUrl = relayUrl;
    this.nostr = window.nostr;
    
    if (!this.nostr) {
      throw new Error('Nostr extension not found. Please install a Nostr browser extension.');
    }
  }

  /**
   * Initiates payment flow for directory entry
   */
  async payForDirectoryEntry(directoryEvent, onProgress) {
    try {
      onProgress?.('Creating payment request...');
      
      // Get user's pubkey
      const userPubkey = await this.nostr.getPublicKey();
      
      // Create and sign the directory event first
      const signedDirectoryEvent = await this.nostr.signEvent(directoryEvent);
      
      // Create zap request referencing the directory event
      const zapRequest = createDirectoryZapRequest(directoryEvent, userPubkey);
      
      // Update the zap request with the actual directory event ID
      const eventTag = zapRequest.tags.find(t => t[0] === 'e');
      if (eventTag) {
        eventTag[1] = signedDirectoryEvent.id;
      }
      
      onProgress?.('Signing payment request...');
      
      // Sign the zap request
      const signedZapRequest = await this.nostr.signEvent(zapRequest);
      
      onProgress?.('Getting payment invoice...');
      
      // Get Lightning invoice from relay's LNURL endpoint
      const invoice = await this.getInvoiceFromRelay(signedZapRequest);
      
      onProgress?.('Please pay the Lightning invoice...');
      
      // Present invoice to user for payment
      const paymentResult = await this.presentInvoiceToUser(invoice, signedZapRequest);
      
      if (paymentResult.paid) {
        onProgress?.('Payment confirmed! Publishing directory entry...');
        
        // Wait for zap receipt and validate
        const zapReceipt = await this.waitForZapReceipt(signedZapRequest, signedDirectoryEvent.id);
        
        if (zapReceipt) {
          // Update directory event status to active
          const activeDirectoryEvent = { ...signedDirectoryEvent };
          const statusTag = activeDirectoryEvent.tags.find(t => t[0] === 'status');
          if (statusTag) {
            statusTag[1] = 'active';
          }
          
          // Re-sign the updated event
          const finalEvent = await this.nostr.signEvent(activeDirectoryEvent);
          
          onProgress?.('Directory entry published successfully!');
          
          return {
            success: true,
            directoryEvent: finalEvent,
            zapReceipt,
            invoice: invoice.pr
          };
        }
      }
      
      throw new Error('Payment was not completed or verified');
      
    } catch (error) {
      console.error('Payment flow error:', error);
      throw error;
    }
  }

  /**
   * Gets Lightning invoice from relay's LNURL endpoint
   */
  async getInvoiceFromRelay(signedZapRequest) {
    try {
      // First, get the relay's LNURL info
      const lnurlInfo = await this.getRelayLNURLInfo();
      
      if (!lnurlInfo.allowsNostr || !lnurlInfo.callback) {
        throw new Error('Relay does not support Nostr zaps');
      }

      // Prepare zap request parameters
      const amount = PAYMENT_CONFIG.ENTRY_PRICE_SATS * 1000; // Convert to millisats
      const zapRequestJson = JSON.stringify(signedZapRequest);
      const encodedZapRequest = encodeURIComponent(zapRequestJson);
      
      // Make request to relay's callback URL
      const callbackUrl = `${lnurlInfo.callback}?amount=${amount}&nostr=${encodedZapRequest}`;
      
      const response = await fetch(callbackUrl);
      const invoiceData = await response.json();
      
      if (invoiceData.status === 'ERROR') {
        throw new Error(invoiceData.reason || 'Failed to get invoice');
      }
      
      if (!invoiceData.pr) {
        throw new Error('No payment request in response');
      }
      
      return {
        pr: invoiceData.pr,
        successAction: invoiceData.successAction,
        routes: invoiceData.routes
      };
      
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw new Error(`Failed to get payment invoice: ${error.message}`);
    }
  }

  /**
   * Gets relay's LNURL information
   */
  async getRelayLNURLInfo() {
    try {
      // This would typically be a well-known endpoint
      // For this example, we'll assume the relay exposes LNURL info at /.well-known/lnurlp/relay
      const relayDomain = new URL(this.relayUrl).hostname;
      const lnurlEndpoint = `https://${relayDomain}/.well-known/lnurlp/relay`;
      
      const response = await fetch(lnurlEndpoint);
      const lnurlInfo = await response.json();
      
      return lnurlInfo;
    } catch (error) {
      // Fallback configuration for testing
      console.warn('Could not fetch LNURL info, using fallback');
      return {
        callback: `https://${new URL(this.relayUrl).hostname}/lnurl/callback`,
        maxSendable: 100000000, // 100k sats
        minSendable: 1000, // 1 sat
        allowsNostr: true,
        nostrPubkey: PAYMENT_CONFIG.RELAY_PUBKEY,
        tag: 'payRequest'
      };
    }
  }

  /**
   * Presents invoice to user for payment
   */
  async presentInvoiceToUser(invoice, zapRequest) {
    return new Promise((resolve) => {
      // Create modal for invoice display
      const modal = this.createInvoiceModal(invoice.pr, zapRequest);
      document.body.appendChild(modal);
      
      // Set up event handlers
      const copyButton = modal.querySelector('.copy-invoice');
      const qrCode = modal.querySelector('.qr-code');
      const closeButton = modal.querySelector('.close-modal');
      const checkPaymentButton = modal.querySelector('.check-payment');
      
      // Generate QR code
      this.generateQRCode(qrCode, invoice.pr);
      
      // Copy invoice to clipboard
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(invoice.pr);
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy Invoice';
        }, 2000);
      });
      
      // Check payment status
      let paymentCheckInterval;
      checkPaymentButton.addEventListener('click', () => {
        checkPaymentButton.disabled = true;
        checkPaymentButton.textContent = 'Checking...';
        
        paymentCheckInterval = setInterval(async () => {
          const isPaid = await this.checkInvoiceStatus(invoice.pr);
          if (isPaid) {
            clearInterval(paymentCheckInterval);
            modal.remove();
            resolve({ paid: true });
          }
        }, 2000);
      });
      
      // Close modal
      closeButton.addEventListener('click', () => {
        if (paymentCheckInterval) {
          clearInterval(paymentCheckInterval);
        }
        modal.remove();
        resolve({ paid: false });
      });
    });
  }

  /**
   * Creates invoice payment modal
   */
  createInvoiceModal(invoice, zapRequest) {
    const modal = document.createElement('div');
    modal.className = 'zap-payment-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Pay for Directory Entry</h3>
            <button class="close-modal" type="button">&times;</button>
          </div>
          <div class="modal-body">
            <p>Amount: <strong>${PAYMENT_CONFIG.ENTRY_PRICE_SATS} sats</strong></p>
            <p>Entry: <strong>${zapRequest.content}</strong></p>
            
            <div class="qr-code-container">
              <div class="qr-code"></div>
            </div>
            
            <div class="invoice-container">
              <textarea readonly class="invoice-text">${invoice}</textarea>
              <button class="copy-invoice" type="button">Copy Invoice</button>
            </div>
            
            <div class="payment-instructions">
              <p>Scan the QR code or copy the invoice to pay with your Lightning wallet.</p>
              <p>After payment, click "Check Payment" to verify and publish your entry.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="check-payment" type="button">Check Payment</button>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .zap-payment-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      .modal-overlay {
        background: rgba(0, 0, 0, 0.8);
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-content {
        background: white;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #eee;
      }
      .modal-body {
        padding: 20px;
      }
      .qr-code-container {
        text-align: center;
        margin: 20px 0;
      }
      .qr-code {
        display: inline-block;
        padding: 10px;
        background: white;
        border: 1px solid #ddd;
      }
      .invoice-container {
        margin: 20px 0;
      }
      .invoice-text {
        width: 100%;
        height: 100px;
        font-family: monospace;
        font-size: 12px;
        resize: vertical;
      }
      .copy-invoice, .check-payment {
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      }
      .copy-invoice:hover, .check-payment:hover {
        background: #0056b3;
      }
      .close-modal {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
      }
      .modal-footer {
        padding: 20px;
        border-top: 1px solid #eee;
        text-align: center;
      }
      .payment-instructions {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 4px;
        margin: 15px 0;
        font-size: 14px;
      }
    `;
    modal.appendChild(style);
    
    return modal;
  }

  /**
   * Generates QR code for Lightning invoice
   */
  generateQRCode(container, invoice) {
    // Simple QR code generation - in production, use a proper QR library
    container.innerHTML = `
      <div style="width: 200px; height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
        <div style="text-align: center;">
          <div>⚡ QR Code</div>
          <div style="font-size: 12px; margin-top: 10px;">Use a QR library like qrcode.js</div>
        </div>
      </div>
    `;
  }

  /**
   * Checks if Lightning invoice has been paid
   */
  async checkInvoiceStatus(invoice) {
    // This would typically query the Lightning node or payment processor
    // For demo purposes, we'll simulate a check
    console.log('Checking invoice status:', invoice);
    
    // In a real implementation, you'd check with your Lightning node
    // return await lightningNode.checkInvoice(invoice);
    
    // For demo, return false (user would need to manually confirm)
    return false;
  }

  /**
   * Waits for zap receipt from relay
   */
  async waitForZapReceipt(zapRequest, directoryEventId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for zap receipt'));
      }, timeoutMs);

      // In a real implementation, you'd subscribe to the relay for zap receipts
      // This is a simplified version
      const checkForReceipt = async () => {
        try {
          // Query relay for zap receipt
          const receipt = await this.queryZapReceipt(zapRequest, directoryEventId);
          if (receipt) {
            clearTimeout(timeout);
            resolve(receipt);
          } else {
            // Check again in 2 seconds
            setTimeout(checkForReceipt, 2000);
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkForReceipt();
    });
  }

  /**
   * Queries relay for zap receipt
   */
  async queryZapReceipt(zapRequest, directoryEventId) {
    // This would connect to the relay and query for zap receipts
    // For demo purposes, we'll return null (no receipt found)
    console.log('Querying for zap receipt...', { zapRequest, directoryEventId });
    return null;
  }
}

/**
 * Utility function to check if user needs to pay
 */
export async function checkUserTrustStatus(userPubkey, relayUrl) {
  try {
    const response = await fetch(`${relayUrl}/api/trust-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pubkey: userPubkey })
    });
    
    const result = await response.json();
    return result.trusted || false;
  } catch (error) {
    console.error('Error checking trust status:', error);
    // Default to requiring payment if check fails
    return false;
  }
}
