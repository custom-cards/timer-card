import {
  LitElement,
  html,
  customElement,
  property,
  TemplateResult,
  css,
  CSSResult,
  PropertyValues
} from "lit-element";

import { TimerCardConfig, HomeAssistant } from "./types";
import { HassEntity } from "home-assistant-js-websocket";
import secondsToDuration from "./seconds_to_duration";
import timerTimeRemaining from "./timer_time_remaining";
import { hasConfigOrEntityChanged } from "./has-changed";
import durationToSeconds from "./duration_to_seconds";
import { fireEvent } from "./fire_event";

@customElement("timer-card")
class RadialMenu extends LitElement {
  @property() public hass?: HomeAssistant;

  @property() private _config?: TimerCardConfig;

  @property() private _timeRemaining?: number;

  private _interval?: number;

  public setConfig(config: TimerCardConfig): void {
    if (!config || !config.entity) {
      throw new Error("Invalid configuration");
    }

    this._config = config;
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearInterval();
  }

  public getCardSize(): number {
    return 1;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    const stateObj = this.hass.states[this._config.entity];

    if (!stateObj) {
      return html`
        <hui-warning
          >${this.hass.localize(
            "ui.panel.lovelace.warning.entity_not_found",
            "entity",
            this._config.entity
          )}</hui-warning
        >
      `;
    }

    return html`
      <ha-card .header="${this._config.name}">
        <div @click="${this._moreInfo}">${this._computeDisplay(stateObj)}</div>
        <mwc-button
          .action="${stateObj.state === "active" ? "pause" : "start"}"
          @click="${this._handleClick}"
        >
          ${stateObj.state === "active" ? "STOP" : "START"}
        </mwc-button>
        <mwc-button .action="${"cancel"}" @click="${this._handleClick}">
          RESET
        </mwc-button>
      </ha-card>
    `;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("_timeRemaining")) {
      return true;
    }

    return hasConfigOrEntityChanged(this, changedProps);
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);

    if (changedProps.has("hass")) {
      const stateObj = this.hass!.states[this._config!.entity];
      const oldHass = changedProps.get("hass") as this["hass"];
      const oldStateObj = oldHass
        ? oldHass.states[this._config!.entity]
        : undefined;

      if (oldStateObj !== stateObj) {
        this._startInterval(stateObj);
      } else if (!stateObj) {
        this._clearInterval();
      }
    }
  }

  private _clearInterval(): void {
    if (this._interval) {
      window.clearInterval(this._interval);
      this._interval = undefined;
    }
  }

  private _startInterval(stateObj: HassEntity): void {
    this._clearInterval();
    this._calculateRemaining(stateObj);

    if (stateObj.state === "active") {
      this._interval = window.setInterval(
        () => this._calculateRemaining(stateObj),
        1000
      );
    }
  }

  private _calculateRemaining(stateObj: HassEntity): void {
    this._timeRemaining = timerTimeRemaining(stateObj);
  }

  private _computeDisplay(stateObj: HassEntity): string | null {
    if (!stateObj) {
      return null;
    }

    return secondsToDuration(
      this._timeRemaining || durationToSeconds(stateObj.attributes["duration"])
    );
  }

  private _moreInfo(): void {
    fireEvent(this, "hass-more-info", {
      entityId: this._config!.entity
    });
  }

  private _handleClick(ev) {
    this.hass!.callService("timer", ev.currentTarget.action, {
      entity_id: this._config!.entity
    });
  }

  static get styles(): CSSResult {
    return css`
      div {
        padding-left: 16px;
        font-size: 24px;
      }
    `;
  }
}
