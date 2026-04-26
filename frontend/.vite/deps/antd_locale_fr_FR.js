import {
  __commonJS
} from "./chunk-G3PMV62Z.js";

// node_modules/@babel/runtime/helpers/interopRequireDefault.js
var require_interopRequireDefault = __commonJS({
  "node_modules/@babel/runtime/helpers/interopRequireDefault.js"(exports, module) {
    function _interopRequireDefault(e) {
      return e && e.__esModule ? e : {
        "default": e
      };
    }
    module.exports = _interopRequireDefault, module.exports.__esModule = true, module.exports["default"] = module.exports;
  }
});

// node_modules/@rc-component/pagination/lib/locale/fr_FR.js
var require_fr_FR = __commonJS({
  "node_modules/@rc-component/pagination/lib/locale/fr_FR.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var locale = {
      // Options
      items_per_page: "/ page",
      jump_to: "Aller à",
      jump_to_confirm: "confirmer",
      page: "Page",
      // Pagination
      prev_page: "Page précédente",
      next_page: "Page suivante",
      prev_5: "5 Pages précédentes",
      next_5: "5 Pages suivantes",
      prev_3: "3 Pages précédentes",
      next_3: "3 Pages suivantes",
      page_size: "taille de la page"
    };
    var _default = exports.default = locale;
  }
});

// node_modules/@rc-component/picker/lib/locale/common.js
var require_common = __commonJS({
  "node_modules/@rc-component/picker/lib/locale/common.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.commonLocale = void 0;
    var commonLocale = exports.commonLocale = {
      yearFormat: "YYYY",
      dayFormat: "D",
      cellMeridiemFormat: "A",
      monthBeforeYear: true
    };
  }
});

// node_modules/@rc-component/picker/lib/locale/fr_FR.js
var require_fr_FR2 = __commonJS({
  "node_modules/@rc-component/picker/lib/locale/fr_FR.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _common = require_common();
    function _typeof(o) {
      "@babel/helpers - typeof";
      return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
        return typeof o2;
      } : function(o2) {
        return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
      }, _typeof(o);
    }
    function ownKeys(e, r) {
      var t = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        r && (o = o.filter(function(r2) {
          return Object.getOwnPropertyDescriptor(e, r2).enumerable;
        })), t.push.apply(t, o);
      }
      return t;
    }
    function _objectSpread(e) {
      for (var r = 1; r < arguments.length; r++) {
        var t = null != arguments[r] ? arguments[r] : {};
        r % 2 ? ownKeys(Object(t), true).forEach(function(r2) {
          _defineProperty(e, r2, t[r2]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r2) {
          Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t, r2));
        });
      }
      return e;
    }
    function _defineProperty(obj, key, value) {
      key = _toPropertyKey(key);
      if (key in obj) {
        Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function _toPropertyKey(t) {
      var i = _toPrimitive(t, "string");
      return "symbol" == _typeof(i) ? i : String(i);
    }
    function _toPrimitive(t, r) {
      if ("object" != _typeof(t) || !t) return t;
      var e = t[Symbol.toPrimitive];
      if (void 0 !== e) {
        var i = e.call(t, r || "default");
        if ("object" != _typeof(i)) return i;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === r ? String : Number)(t);
    }
    var locale = _objectSpread(_objectSpread({}, _common.commonLocale), {}, {
      locale: "fr_FR",
      today: "Aujourd'hui",
      now: "Maintenant",
      backToToday: "Aujourd'hui",
      ok: "OK",
      clear: "Rétablir",
      week: "Semaine",
      month: "Mois",
      year: "Année",
      timeSelect: "Sélectionner l'heure",
      dateSelect: "Sélectionner la date",
      monthSelect: "Choisissez un mois",
      yearSelect: "Choisissez une année",
      decadeSelect: "Choisissez une décennie",
      dayFormat: "DD",
      previousMonth: "Mois précédent (PageUp)",
      nextMonth: "Mois suivant (PageDown)",
      previousYear: "Année précédente (Ctrl + gauche)",
      nextYear: "Année prochaine (Ctrl + droite)",
      previousDecade: "Décennie précédente",
      nextDecade: "Décennie suivante",
      previousCentury: "Siècle précédent",
      nextCentury: "Siècle suivant"
    });
    var _default = exports.default = locale;
  }
});

// node_modules/antd/lib/time-picker/locale/fr_FR.js
var require_fr_FR3 = __commonJS({
  "node_modules/antd/lib/time-picker/locale/fr_FR.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var locale = {
      placeholder: "Sélectionner l'heure",
      rangePlaceholder: ["Heure de début", "Heure de fin"]
    };
    var _default = exports.default = locale;
  }
});

// node_modules/antd/lib/date-picker/locale/fr_FR.js
var require_fr_FR4 = __commonJS({
  "node_modules/antd/lib/date-picker/locale/fr_FR.js"(exports) {
    "use strict";
    var _interopRequireDefault = require_interopRequireDefault().default;
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _fr_FR = _interopRequireDefault(require_fr_FR2());
    var _fr_FR2 = _interopRequireDefault(require_fr_FR3());
    var locale = {
      lang: {
        placeholder: "Sélectionner une date",
        yearPlaceholder: "Sélectionner une année",
        quarterPlaceholder: "Sélectionner un trimestre",
        monthPlaceholder: "Sélectionner un mois",
        weekPlaceholder: "Sélectionner une semaine",
        rangePlaceholder: ["Date de début", "Date de fin"],
        rangeYearPlaceholder: ["Année de début", "Année de fin"],
        rangeMonthPlaceholder: ["Mois de début", "Mois de fin"],
        rangeWeekPlaceholder: ["Semaine de début", "Semaine de fin"],
        ..._fr_FR.default
      },
      timePickerLocale: {
        ..._fr_FR2.default
      }
    };
    var _default = exports.default = locale;
  }
});

// node_modules/antd/lib/calendar/locale/fr_FR.js
var require_fr_FR5 = __commonJS({
  "node_modules/antd/lib/calendar/locale/fr_FR.js"(exports) {
    "use strict";
    var _interopRequireDefault = require_interopRequireDefault().default;
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _fr_FR = _interopRequireDefault(require_fr_FR4());
    var _default = exports.default = _fr_FR.default;
  }
});

// node_modules/antd/lib/locale/fr_FR.js
var require_fr_FR6 = __commonJS({
  "node_modules/antd/lib/locale/fr_FR.js"(exports) {
    "use strict";
    var _interopRequireDefault = require_interopRequireDefault().default;
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var _fr_FR = _interopRequireDefault(require_fr_FR());
    var _fr_FR2 = _interopRequireDefault(require_fr_FR5());
    var _fr_FR3 = _interopRequireDefault(require_fr_FR4());
    var _fr_FR4 = _interopRequireDefault(require_fr_FR3());
    var typeTemplate = "La valeur du champ ${label} n'est pas valide pour le type ${type}";
    var localeValues = {
      locale: "fr",
      Pagination: _fr_FR.default,
      DatePicker: _fr_FR3.default,
      TimePicker: _fr_FR4.default,
      Calendar: _fr_FR2.default,
      global: {
        close: "Fermer"
      },
      Table: {
        filterTitle: "Filtrer",
        filterConfirm: "OK",
        filterReset: "Réinitialiser",
        filterEmptyText: "Aucun filtre",
        filterCheckAll: "Tout sélectionner",
        filterSearchPlaceholder: "Chercher dans les filtres",
        emptyText: "Aucune donnée",
        selectAll: "Sélectionner la page actuelle",
        selectInvert: "Inverser la sélection de la page actuelle",
        selectNone: "Désélectionner toutes les données",
        selectionAll: "Sélectionner toutes les données",
        sortTitle: "Trier",
        expand: "Développer la ligne",
        collapse: "Réduire la ligne",
        triggerDesc: "Trier par ordre décroissant",
        triggerAsc: "Trier par ordre croissant",
        cancelSort: "Annuler le tri"
      },
      Tour: {
        Next: "Étape suivante",
        Previous: "Étape précédente",
        Finish: "Fin de la visite guidée"
      },
      Modal: {
        okText: "OK",
        cancelText: "Annuler",
        justOkText: "OK"
      },
      Popconfirm: {
        okText: "OK",
        cancelText: "Annuler"
      },
      Transfer: {
        titles: ["", ""],
        searchPlaceholder: "Rechercher",
        itemUnit: "élément",
        itemsUnit: "éléments",
        remove: "Désélectionner",
        selectCurrent: "Sélectionner la page actuelle",
        removeCurrent: "Désélectionner la page actuelle",
        selectAll: "Sélectionner toutes les données",
        removeAll: "Désélectionner toutes les données",
        selectInvert: "Inverser la sélection de la page actuelle"
      },
      Upload: {
        uploading: "Téléchargement...",
        removeFile: "Effacer le fichier",
        uploadError: "Erreur de téléchargement",
        previewFile: "Fichier de prévisualisation",
        downloadFile: "Télécharger un fichier"
      },
      Empty: {
        description: "Aucune donnée"
      },
      Icon: {
        icon: "icône"
      },
      Text: {
        edit: "Éditer",
        copy: "Copier",
        copied: "Copie effectuée",
        expand: "Développer"
      },
      Form: {
        optional: "(optionnel)",
        defaultValidateMessages: {
          default: "Erreur de validation pour le champ ${label}",
          required: "Le champ ${label} est obligatoire",
          enum: "La valeur du champ ${label} doit être parmi [${enum}]",
          whitespace: "La valeur du champ ${label} ne peut pas être vide",
          date: {
            format: "La valeur du champ ${label} n'est pas au format date",
            parse: "La valeur du champ ${label} ne peut pas être convertie vers une date",
            invalid: "La valeur du champ ${label} n'est pas une date valide"
          },
          types: {
            string: typeTemplate,
            method: typeTemplate,
            array: typeTemplate,
            object: typeTemplate,
            number: typeTemplate,
            date: typeTemplate,
            boolean: typeTemplate,
            integer: typeTemplate,
            float: typeTemplate,
            regexp: typeTemplate,
            email: typeTemplate,
            url: typeTemplate,
            hex: typeTemplate
          },
          string: {
            len: "La taille du champ ${label} doit être de ${len} caractères",
            min: "La taille du champ ${label} doit être au minimum de ${min} caractères",
            max: "La taille du champ ${label} doit être au maximum de ${max} caractères",
            range: "La taille du champ ${label} doit être entre ${min} et ${max} caractères"
          },
          number: {
            len: "La valeur du champ ${label} doit être égale à ${len}",
            min: "La valeur du champ ${label} doit être plus grande que ${min}",
            max: "La valeur du champ ${label} doit être plus petit que ${max}",
            range: "La valeur du champ ${label} doit être entre ${min} et ${max}"
          },
          array: {
            len: "La taille du tableau ${label} doit être de ${len}",
            min: "La taille du tableau ${label} doit être au minimum de ${min}",
            max: "La taille du tableau ${label} doit être au maximum de ${max}",
            range: "La taille du tableau ${label} doit être entre ${min}-${max}"
          },
          pattern: {
            mismatch: "La valeur du champ ${label} ne correspond pas au modèle ${pattern}"
          }
        }
      }
    };
    var _default = exports.default = localeValues;
  }
});

// node_modules/antd/locale/fr_FR.js
var require_fr_FR7 = __commonJS({
  "node_modules/antd/locale/fr_FR.js"(exports, module) {
    module.exports = require_fr_FR6();
  }
});
export default require_fr_FR7();
//# sourceMappingURL=antd_locale_fr_FR.js.map
