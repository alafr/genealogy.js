 "use strict";
var Genealogy = function(txt) {
  let g = this;
  var Fragment = function(index, tag, ref, value) {
    this.index = index;
    this.tag = tag;
    this.ref = ref;
    this.value = value;
    this.children = [];
  };
  Fragment.prototype.getId = function() {
    return this.index;
  };
  Fragment.prototype.getValue = function() {
    let result = this.value || '';
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === 'CONC') {result += children[i].value;}
      else if (children[i].tag === 'CONT') {result += '\n' + children[i].value;}
    }
    if (g.encoding === 'ANSEL') {
      result = result.replace(/([\xE0-\xFF]?)([\xE0-\xFF]?)([\xE0-\xFF]?)(?:([\x00-\x7F])|([\x80-\xDF]))/g, function(x, p1, p2, p3, p4, p5) {
        return CharsAnsel[x] || (p4 ? p4 : CharsAnsel[p5] || '') + (CharsAnsel[p1] || '') + (CharsAnsel[p2] || '') + (CharsAnsel[p3] || '');
      });
    } else if (g.encoding === 'ANSI' || g.encoding === 'ASCII' || g.encoding === 'WINDOWS') {
      result = result.replace(/[\x80-\x9F]/g, function(x) {return Chars1252[x];});
    } else if (g.encoding === 'UTF-8') {
      result = result.replace(/([\xC2-\xDF][\x80-\xBF])|([\xE0-\xEF][\x80-\xBF]{2})|([^\x00-\x7F])/g, function(x, p1, p2, p3) {
        if (p1) {return String.fromCharCode(((p1.charCodeAt(0) & 0x1F) << 6) | (p1.charCodeAt(1) & 0x3F));}
        if (p2) {return String.fromCharCode(((p2.charCodeAt(0) & 0x0F) << 12) | ((p2.charCodeAt(1) & 0x3F) << 6) | ((p2.charCodeAt(2) & 0x3F) << 0));}
        if (p3) {return '';}
      });
    }
    return result;
  };
  Fragment.prototype.getRecord = function(records) {
    return this.ref && records[this.ref] || null;
  };
  Fragment.prototype.getChild = function(tag) {
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {return children[i];}
    }
    return null;
  };
  Fragment.prototype.getChildren = function(tag) {
    let result = [];
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {result.push(children[i]);}
    }
    return result;
  };
  Fragment.prototype.getChildValue = function(tag) {
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {return children[i].getValue();}
    }
    return '';
  };
  Fragment.prototype.getChildrenValues = function(tag) {
    let result = [];
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {result.push(children[i].getValue());}
    }
    return result;
  };
  Fragment.prototype.getChildRecord = function(tag, records) {
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {return children[i].getRecord(records) || null;}
    }
    return null;
  };
  Fragment.prototype.getChildrenRecords = function(tag, records) {
    let result = [];
    let children = this.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tag === tag) {
        let record = children[i].getRecord(records);
        if (record) {result.push(record);}
      }
    }
    return result;
  };
  Fragment.prototype.delete = function() {
    let parent = this.parent;
    if (parent) {
      let children = parent.children;
      for (let i = 0; i < children.length; i++) {
        if (children[i] === this) {children.splice(i--, 1);}
      }
    }
  };
  var Event = function(obj) {
    this.description = obj.getValue();
    this.cause = obj.getChildValue('CAUS');
    this.dateString = obj.getChildValue('DATE');
    this.date = parseDate(this.dateString);
    this.year = this.date ? this.date.year : null;
    this.exact = this.date ? this.date.exact : null;
    this.place = obj.getChildValue('PLAC'); 
  };
  var Note = function(obj) {
    this.obj = obj;
    this.id = this.obj.getId();
  };
  var Family = function(obj) {
    this.obj = obj;
    this.id = this.obj.getId();
  };
  var Person = function(obj) {
    this.obj = obj;
    this.id = this.obj.getId();
  };
  Note.prototype.init = function() {
    this.content = this.obj.getValue();
  };
  Family.prototype.createEvent = function(obj) {
    if (!obj) {return null;}
    return new Event(obj);
  };
  Family.prototype.init = function() {
    this.marriage = this.createEvent(this.obj.getChild('MARR'));
    this.divorce = this.createEvent(this.obj.getChild('DIV'));
    this.areMarried = this.marriage != null && this.divorce == null;
    this.husband = this.obj.getChildRecord('HUSB', g.personsRecords);
    this.wife = this.obj.getChildRecord('WIFE', g.personsRecords);
    this.children = this.obj.getChildrenRecords('CHIL', g.personsRecords);
  };
  Family.prototype.toString = function() {
    return (this.husband ? this.husband.toString() : 'unknown') + ' & ' + (this.wife ? this.wife.toString() : 'unknown');
  };
  Person.prototype.createEvent = function(obj) {
    if (!obj) {return null;}
    return new Event(obj);
  };
  Person.prototype.init = function() {
    this.sex = {'F':'Female', 'M':'Male'}[this.obj.getChildValue('SEX')] || 'Unknown';
    let name = this.obj.getChild('NAME');
    this.surname = name ? name.getChildValue('SURN') || (name.getValue().split('/')[1] || '').trim() : '';
    this.given = name ? name.getChildValue('GIVN') || (name.getValue().split('/')[0] || '').trim() : '';
    this.birth = this.createEvent(this.obj.getChild('BIRT'));
    this.baptism = this.createEvent(this.obj.getChild('BAPM'));
    this.death = this.createEvent(this.obj.getChild('DEAT'));
    this.burial = this.createEvent(this.obj.getChild('BURI'));
    this.occupations = this.obj.getChildren('OCCU').map(this.createEvent);
    this.censuses = this.obj.getChildren('CENS').map(this.createEvent);
    this.parentFamily = this.obj.getChildRecord('FAMC', g.familiesRecords);
    this.spouseFamilies = this.obj.getChildrenRecords('FAMS', g.familiesRecords);
  };
  Object.defineProperty(Person.prototype, 'father', {get: function() {
    return this.parentFamily ? this.parentFamily.husband : null;
  }});
  Object.defineProperty(Person.prototype, 'mother', {get: function() {
    return this.parentFamily ? this.parentFamily.wife : null;
  }});
  Object.defineProperty(Person.prototype, 'spouses', {get: function() {
    let spouses = [];
    for (let i = 0; i < this.spouseFamilies.length; i++) {
      let family = this.spouseFamilies[i];
      let spouse = (family.husband === this ? family.wife : family.husband);
      if (spouse && family.areMarried) {spouses.push(spouse);}
    }
    return spouses;
  }});
  Person.prototype.toString = function() {
    return this.given + ' ' + this.surname;
  };
  Person.prototype.getRelatives = function(link, onlyLast) {
    let found = [this], prevgen = [this], result = [];
    for (let g = 0; g < link.length; g++) {
      let currgen = [];
      for (let i = 0; i < prevgen.length; i++) {
        let person = prevgen[i];
        if (link[g] === 'this') {
          currgen = [this];
        }
        if (link[g] === 'spouse') {
          let spouses = person.spouses;
          for (let m = 0; m < spouses.length; m++) {
            if (found.indexOf(spouses[m]) === -1) {
              currgen.push(spouses[m]);
              found.push(spouses[m]);
            }
          }
        }
        if (link[g] === 'child') {
          let families = person.spouseFamilies;
          for (let m = 0; m < families.length; m++) {
            let children = families[m].children;
            for (let c = 0; c < children.length; c++) {
              if (found.indexOf(children[c]) === -1) {
                currgen.push(children[c]);
                found.push(children[c]);
              }
            }
          }
        }
        if (link[g] === 'parent' || link[g] === 'mother') {
          let mother = person.mother;
          if (mother && found.indexOf(mother) === -1) {
            currgen.push(mother);
            found.push(mother);
          }
        }
        if (link[g] === 'parent' || link[g] === 'father') {
          let father = person.father;
          if (father && found.indexOf(father) === -1) {
            currgen.push(father);
            found.push(father);
          }
        }
        if (link[g] === 'sibling') {
          let family = person.parentFamily;
          if (family) {
            let children = family.children;
            for (let m = 0; m < children.length; m++) {
              if (found.indexOf(children[m]) === -1) {
                currgen.push(children[m]);
                found.push(children[m]);
              }
            }
          }
        }
      }
      if (onlyLast === false) {
        result = result.concat(currgen);
      }
      if (g === link.length - 1) {
        if (onlyLast !== false) {
          return currgen;
        }
      } else {
        prevgen = currgen;
      }
    }
    return result;
  };
  Person.prototype.getPathToPerson = function(otherPerson, maxSteps) {
    let found = [this], prev = [[{person: this, link: 'this'}]], nsteps = 0;
    let links = ['parent', 'sibling', 'spouse', 'child'];
    maxSteps = maxSteps || 20;
    while (nsteps++ < maxSteps && prev.length !== 0) {
      let curr = [];
      for (let n = 0; n < prev.length; n++) {
        let stack = prev[n], person = stack[stack.length - 1].person;
        for (let l = 0; l < links.length; l++) {
          let newPersons = person.getRelatives([links[l]]);
          for (let i = 0; i < newPersons.length; i++) {
            if (found.indexOf(newPersons[i]) === -1) {
              let newStack = stack.concat({person: newPersons[i], link: links[l]});
              if (newPersons[i] === otherPerson) {
                newStack.toString = function() {return this.map(function(step) {return step.link + ': ' + step.person.toString();}).join('\r\n');};
                return newStack;
              } else {
                curr.push(newStack);
                found.push(newPersons[i]);
              }
            }
          }
        }
      }
      prev = curr;
    }
    return null;
  };
  Person.prototype.getSosa = function(n) {
    let link = n.toString(2).substring(1).split('');
    for (var i = 0; i < link.length; i++) {
      link[i] = ['father', 'mother'][link[i]];
    }
    return this.getRelatives(link)[0] || null;
  };
  Person.prototype.getAllCousins = function(ascGens, cousinsGens, descGens, spouses) {
    let result = [this];
    if (ascGens) {
      let ascLink = []; for (let g = 0; g < ascGens; g++) {ascLink.push('parent');}
      this.getRelatives(ascLink, false).forEach(function(p) {
        if (result.indexOf(p) === -1) {result.push(p);}
      });
    }
    if (cousinsGens) {
      let cousinsLink = []; for (let g = 0; g < cousinsGens; g++) {cousinsLink.push('child');}
      result.forEach(function(p1) {
        p1.getRelatives(cousinsLink, false).forEach(function(p) {
          if (result.indexOf(p) === -1) {result.push(p);}
        });
      });
    }
    if (descGens) {
      let descLink = []; for (let g = 0; g < descGens; g++) {descLink.push('child');}
      this.getRelatives(descLink, false).forEach(function(p) {
        if (result.indexOf(p) === -1) {result.push(p);}
      });
    }
    if (spouses) {
      result.forEach(function(p1) {
        p1.getRelatives(['spouse'], false).forEach(function(p) {
          if (result.indexOf(p) === -1) {result.push(p);}
        });
      });
    }
    return result;
  };
  g.createPersonSelector = function(selects, functions, onchange) {
    let names = {};
    let length = Math.min(selects.length, functions.length);
    g.persons.forEach(function(person) {
      let curr = names;
      for (let i = 0; i < length; i++) {
        let value = functions[i](person);
        if (value == null) {break;}
        if (i !== length - 1) {
          if (!curr[value]) {curr[value] = {};}
          curr = curr[value]; // recursion
        } else {
          if (!curr[value]) {curr[value] = [];}
          curr[value].push(person);
        }
      }
    });
    var populateList = function(curr, i) {
      curr = curr || {};
      let select = selects[i];
      while (select.options.length > 0) {select.remove(0);}
      Object.keys(curr).sort().forEach(function(value) {
        if (i === length - 1) {
          curr[value].forEach(function(person) {
            let newOption = document.createElement('option');
            newOption.value = person.id;
            newOption.textContent = value.replace(/\s/g, '\xA0');
            select.add(newOption);
          });
        } else {
          let newOption = document.createElement('option');
          newOption.value = value;
          newOption.textContent = value.replace(/\s/g, '\xA0');
          select.add(newOption);
        }
      });
      if (i === length - 1) {
        select.onchange = function() {
          if (onchange) {onchange(g.personsRecords[select.value]);}
        };
      } else {
        select.onchange = function() {
          populateList(curr[select.value], i + 1);
        };
      }
      select.onchange();
    };
    populateList(names, 0);
  };
  var CharsAnsel = /* http://heiner-eichmann.de/gedcom/charintr.htm */ {'\xA1':'\u0141','\xA2':'\xD8','\xA3':'\u0110','\xA4':'\xDE','\xA5':'\xC6','\xA6':'\u0152','\xA7':'\u02B9','\xA8':'\xB7','\xA9':'\u266D','\xAA':'\xAE','\xAB':'\xB1','\xAC':'\u01A0','\xAD':'\u01AF','\xAE':'\u02BC','\xB0':'\u02BB','\xB1':'\u0142','\xB2':'\xF8','\xB3':'\u0111','\xB4':'\xFE','\xB5':'\xE6','\xB6':'\u0153','\xB7':'\u02BA','\xB8':'\u0131','\xB9':'\xA3','\xBA':'\xF0','\xBC':'\u01A1','\xBD':'\u01B0','\xC0':'\xB0','\xC1':'\u2113',
    '\xC2':'\u2117','\xC3':'\xA9','\xC4':'\u266F','\xC5':'\xBF','\xC6':'\xA1','\xCF':'\xDF','\xE0':'\u0309','\xE1':'\u0300','\xE2':'\u0301','\xE3':'\u0302','\xE4':'\u0303','\xE5':'\u0304','\xE6':'\u0306','\xE7':'\u0307','\xE8':'\u0308','\xE9':'\u030C','\xEA':'\u030A','\xEB':'\uFE20','\xEC':'\uFE21','\xED':'\u0315','\xEE':'\u030B','\xEF':'\u0310','\xF0':'\u0327','\xF1':'\u0328','\xF2':'\u0323','\xF3':'\u0324','\xF4':'\u0325','\xF5':'\u0333','\xF6':'\u0332','\xF7':'\u0326','\xF8':'\u031C','\xF9':'\u032E',
    '\xFA':'\uFE22','\xFB':'\uFE23','\xFE':'\u0313','\xE1\x41':'\xC0','\xE2\x41':'\xC1','\xE3\x41':'\xC2','\xE4\x41':'\xC3','\xE8\x41':'\xC4','\xEA\x41':'\xC5','\xF0\x43':'\xC7','\xE1\x45':'\xC8','\xE2\x45':'\xC9','\xE3\x45':'\xCA','\xE8\x45':'\xCB','\xE1\x49':'\xCC','\xE2\x49':'\xCD','\xE3\x49':'\xCE','\xE8\x49':'\xCF','\xE4\x4E':'\xD1','\xE1\x4F':'\xD2','\xE2\x4F':'\xD3','\xE3\x4F':'\xD4','\xE4\x4F':'\xD5','\xE8\x4F':'\xD6','\xE1\x55':'\xD9','\xE2\x55':'\xDA','\xE3\x55':'\xDB','\xE8\x55':'\xDC',
    '\xE2\x59':'\xDD','\xE1\x61':'\xE0','\xE2\x61':'\xE1','\xE3\x61':'\xE2','\xE4\x61':'\xE3','\xE8\x61':'\xE4','\xEA\x61':'\xE5','\xF0\x63':'\xE7','\xE1\x65':'\xE8','\xE2\x65':'\xE9','\xE3\x65':'\xEA','\xE8\x65':'\xEB','\xE1\x69':'\xEC','\xE2\x69':'\xED','\xE3\x69':'\xEE','\xE8\x69':'\xEF','\xE4\x6E':'\xF1','\xE1\x6F':'\xF2','\xE2\x6F':'\xF3','\xE3\x6F':'\xF4','\xE4\x6F':'\xF5','\xE8\x6F':'\xF6','\xE1\x75':'\xF9','\xE2\x75':'\xFA','\xE3\x75':'\xFB','\xE8\x75':'\xFC','\xE2\x79':'\xFD','\xE8\x79':'\xFF',
    '\xE5\x41':'\u0100','\xE5\x61':'\u0101','\xE6\x41':'\u0102','\xE6\x61':'\u0103','\xF1\x41':'\u0104','\xF1\x61':'\u0105','\xE2\x43':'\u0106','\xE2\x63':'\u0107','\xE3\x43':'\u0108','\xE3\x63':'\u0109','\xE7\x43':'\u010A','\xE7\x63':'\u010B','\xE9\x43':'\u010C','\xE9\x63':'\u010D','\xE9\x44':'\u010E','\xE9\x64':'\u010F','\xE5\x45':'\u0112','\xE5\x65':'\u0113','\xE6\x45':'\u0114','\xE6\x65':'\u0115','\xE7\x45':'\u0116','\xE7\x65':'\u0117','\xF1\x45':'\u0118','\xF1\x65':'\u0119',
    '\xE9\x45':'\u011A','\xE9\x65':'\u011B','\xE3\x47':'\u011C','\xE3\x67':'\u011D','\xE6\x47':'\u011E','\xE6\x67':'\u011F','\xE7\x47':'\u0120','\xE7\x67':'\u0121','\xF0\x47':'\u0122','\xF0\x67':'\u0123','\xE3\x48':'\u0124','\xE3\x68':'\u0125','\xE4\x49':'\u0128','\xE4\x69':'\u0129','\xE5\x49':'\u012A','\xE5\x69':'\u012B','\xE6\x49':'\u012C','\xE6\x69':'\u012D','\xF1\x49':'\u012E','\xF1\x69':'\u012F','\xE7\x49':'\u0130','\xE3\x4A':'\u0134','\xE3\x6A':'\u0135','\xF0\x4B':'\u0136',
    '\xF0\x6B':'\u0137','\xE2\x4C':'\u0139','\xE2\x6C':'\u013A','\xF0\x4C':'\u013B','\xF0\x6C':'\u013C','\xE9\x4C':'\u013D','\xE9\x6C':'\u013E','\xE2\x4E':'\u0143','\xE2\x6E':'\u0144','\xF0\x4E':'\u0145','\xF0\x6E':'\u0146','\xE9\x4E':'\u0147','\xE9\x6E':'\u0148','\xE5\x4F':'\u014C','\xE5\x6F':'\u014D','\xE6\x4F':'\u014E','\xE6\x6F':'\u014F','\xEE\x4F':'\u0150','\xEE\x6F':'\u0151','\xE2\x52':'\u0154','\xE2\x72':'\u0155','\xF0\x52':'\u0156','\xF0\x72':'\u0157','\xE9\x52':'\u0158',
    '\xE9\x72':'\u0159','\xE2\x53':'\u015A','\xE2\x73':'\u015B','\xE3\x53':'\u015C','\xE3\x73':'\u015D','\xF0\x53':'\u015E','\xF0\x73':'\u015F','\xE9\x53':'\u0160','\xE9\x73':'\u0161','\xF0\x54':'\u0162','\xF0\x74':'\u0163','\xE9\x54':'\u0164','\xE9\x74':'\u0165','\xE4\x55':'\u0168','\xE4\x75':'\u0169','\xE5\x55':'\u016A','\xE5\x75':'\u016B','\xE6\x55':'\u016C','\xE6\x75':'\u016D','\xEA\x55':'\u016E','\xEA\x75':'\u016F','\xEE\x55':'\u0170','\xEE\x75':'\u0171','\xF1\x55':'\u0172',
    '\xF1\x75':'\u0173','\xE3\x57':'\u0174','\xE3\x77':'\u0175','\xE3\x59':'\u0176','\xE3\x79':'\u0177','\xE8\x59':'\u0178','\xE2\x5A':'\u0179','\xE2\x7A':'\u017A','\xE7\x5A':'\u017B','\xE7\x7A':'\u017C','\xE9\x5A':'\u017D','\xE9\x7A':'\u017E','\xE9\x41':'\u01CD','\xE9\x61':'\u01CE','\xE9\x49':'\u01CF','\xE9\x69':'\u01D0','\xE9\x4F':'\u01D1','\xE9\x6F':'\u01D2','\xE9\x55':'\u01D3','\xE9\x75':'\u01D4','\xE8\xE5\x55':'\u01D5','\xE5\xE8\x55':'\u01D5','\xE8\xE5\x75':'\u01D6',
    '\xE5\xE8\x75':'\u01D6','\xE8\xE2\x55':'\u01D7','\xE2\xE8\x55':'\u01D7','\xE8\xE2\x75':'\u01D8','\xE2\xE8\x75':'\u01D8','\xE8\xE9\x55':'\u01D9','\xE9\xE8\x55':'\u01D9','\xE8\xE9\x75':'\u01DA','\xE9\xE8\x75':'\u01DA','\xE8\xE1\x55':'\u01DB','\xE1\xE8\x55':'\u01DB','\xE8\xE1\x75':'\u01DC','\xE1\xE8\x75':'\u01DC','\xE8\xE5\x41':'\u01DE','\xE5\xE8\x41':'\u01DE','\xE8\xE5\x61':'\u01DF','\xE5\xE8\x61':'\u01DF','\xE7\xE5\x41':'\u01E0','\xE5\xE7\x41':'\u01E0','\xE7\xE5\x61':'\u01E1',
    '\xE5\xE7\x61':'\u01E1','\xE5\xC6':'\u01E2','\xE5\xE6':'\u01E3','\xE9\x47':'\u01E6','\xE9\x67':'\u01E7','\xE9\x4B':'\u01E8','\xE9\x6B':'\u01E9','\xF1\x4F':'\u01EA','\xF1\x6F':'\u01EB','\xF1\xE5\x4F':'\u01EC','\xE5\xF1\x4F':'\u01EC','\xF1\xE5\x6F':'\u01ED','\xE5\xF1\x6F':'\u01ED','\xE9\x6A':'\u01F0','\xE2\x47':'\u01F4','\xE2\x67':'\u01F5','\xEA\xE2\x41':'\u01FA','\xE2\xEA\x41':'\u01FA','\xEA\xE2\x61':'\u01FB','\xE2\xEA\x61':'\u01FB','\xE2\xC6':'\u01FC','\xE2\xE6':'\u01FD','\xF4\x41':'\u1E00',
    '\xF4\x61':'\u1E01','\xE7\x42':'\u1E02','\xE7\x62':'\u1E03','\xF2\x42':'\u1E04','\xF2\x62':'\u1E05','\xF6\x42':'\u1E06','\xF6\x62':'\u1E07','\xF0\xE2\x43':'\u1E08','\xE2\xF0\x43':'\u1E08','\xF0\xE2\x63':'\u1E09','\xE2\xF0\x63':'\u1E09','\xE7\x44':'\u1E0A','\xE7\x64':'\u1E0B','\xF2\x44':'\u1E0C','\xF2\x64':'\u1E0D','\xF6\x44':'\u1E0E','\xF6\x64':'\u1E0F','\xF0\x44':'\u1E10','\xF0\x64':'\u1E11','\xE5\xE1\x45':'\u1E14','\xE1\xE5\x45':'\u1E14','\xE5\xE1\x65':'\u1E15','\xE1\xE5\x65':'\u1E15',
    '\xE5\xE2\x45':'\u1E16','\xE2\xE5\x45':'\u1E16','\xE5\xE2\x65':'\u1E17','\xE2\xE5\x65':'\u1E17','\xF0\xE6\x45':'\u1E1C','\xE6\xF0\x45':'\u1E1C','\xF0\xE6\x65':'\u1E1D','\xE6\xF0\x65':'\u1E1D','\xE7\x46':'\u1E1E','\xE7\x66':'\u1E1F','\xE5\x47':'\u1E20','\xE5\x67':'\u1E21','\xE7\x48':'\u1E22','\xE7\x68':'\u1E23','\xF2\x48':'\u1E24','\xF2\x68':'\u1E25','\xE8\x48':'\u1E26','\xE8\x68':'\u1E27','\xF0\x48':'\u1E28','\xF0\x68':'\u1E29','\xF9\x48':'\u1E2A','\xF9\x68':'\u1E2B','\xE8\xE2\x49':'\u1E2E',
    '\xE2\xE8\x49':'\u1E2E','\xE8\xE2\x69':'\u1E2F','\xE2\xE8\x69':'\u1E2F','\xE2\x4B':'\u1E30','\xE2\x6B':'\u1E31','\xF2\x4B':'\u1E32','\xF2\x6B':'\u1E33','\xF6\x4B':'\u1E34','\xF6\x6B':'\u1E35','\xF2\x4C':'\u1E36','\xF2\x6C':'\u1E37','\xF2\xE5\x4C':'\u1E38','\xE5\xF2\x4C':'\u1E38','\xF2\xE5\x6C':'\u1E39','\xE5\xF2\x6C':'\u1E39','\xF6\x4C':'\u1E3A','\xF6\x6C':'\u1E3B','\xE2\x4D':'\u1E3E','\xE2\x6D':'\u1E3F','\xE7\x4D':'\u1E40','\xE7\x6D':'\u1E41','\xF2\x4D':'\u1E42','\xF2\x6D':'\u1E43',
    '\xE7\x4E':'\u1E44','\xE7\x6E':'\u1E45','\xF2\x4E':'\u1E46','\xF2\x6E':'\u1E47','\xF6\x4E':'\u1E48','\xF6\x6E':'\u1E49','\xE4\xE2\x4F':'\u1E4C','\xE2\xE4\x4F':'\u1E4C','\xE4\xE2\x6F':'\u1E4D','\xE2\xE4\x6F':'\u1E4D','\xE4\xE8\x4F':'\u1E4E','\xE8\xE4\x4F':'\u1E4E','\xE4\xE8\x6F':'\u1E4F','\xE8\xE4\x6F':'\u1E4F','\xE5\xE1\x4F':'\u1E50','\xE1\xE5\x4F':'\u1E50','\xE5\xE1\x6F':'\u1E51','\xE1\xE5\x6F':'\u1E51','\xE5\xE2\x4F':'\u1E52','\xE2\xE5\x4F':'\u1E52','\xE5\xE2\x6F':'\u1E53',
    '\xE2\xE5\x6F':'\u1E53','\xE2\x50':'\u1E54','\xE2\x70':'\u1E55','\xE7\x50':'\u1E56','\xE7\x70':'\u1E57','\xE7\x52':'\u1E58','\xE7\x72':'\u1E59','\xF2\x52':'\u1E5A','\xF2\x72':'\u1E5B','\xF2\xE5\x52':'\u1E5C','\xE5\xF2\x52':'\u1E5C','\xF2\xE5\x72':'\u1E5D','\xE5\xF2\x72':'\u1E5D','\xF6\x52':'\u1E5E','\xF6\x72':'\u1E5F','\xE7\x53':'\u1E60','\xE7\x73':'\u1E61','\xF2\x53':'\u1E62','\xF2\x73':'\u1E63','\xE2\xE7\x53':'\u1E64','\xE7\xE2\x53':'\u1E64','\xE2\xE7\x73':'\u1E65','\xE7\xE2\x73':'\u1E65',
    '\xE9\xE7\x53':'\u1E66','\xE7\xE9\x53':'\u1E66','\xE9\xE7\x73':'\u1E67','\xE7\xE9\x73':'\u1E67','\xF2\xE7\x53':'\u1E68','\xE7\xF2\x53':'\u1E68','\xF2\xE7\x73':'\u1E69','\xE7\xF2\x73':'\u1E69','\xE7\x54':'\u1E6A','\xE7\x74':'\u1E6B','\xF2\x54':'\u1E6C','\xF2\x74':'\u1E6D','\xF6\x54':'\u1E6E','\xF6\x74':'\u1E6F','\xF3\x55':'\u1E72','\xF3\x75':'\u1E73','\xE4\xE2\x55':'\u1E78','\xE2\xE4\x55':'\u1E78','\xE4\xE2\x75':'\u1E79','\xE2\xE4\x75':'\u1E79','\xE5\xE8\x55':'\u1E7A','\xE8\xE5\x55':'\u1E7A',
    '\xE5\xE8\x75':'\u1E7B','\xE8\xE5\x75':'\u1E7B','\xE4\x56':'\u1E7C','\xE4\x76':'\u1E7D','\xF2\x56':'\u1E7E','\xF2\x76':'\u1E7F','\xE1\x57':'\u1E80','\xE1\x77':'\u1E81','\xE2\x57':'\u1E82','\xE2\x77':'\u1E83','\xE8\x57':'\u1E84','\xE8\x77':'\u1E85','\xE7\x57':'\u1E86','\xE7\x77':'\u1E87','\xF2\x57':'\u1E88','\xF2\x77':'\u1E89','\xE7\x58':'\u1E8A','\xE7\x78':'\u1E8B','\xE8\x58':'\u1E8C','\xE8\x78':'\u1E8D','\xE7\x59':'\u1E8E','\xE7\x79':'\u1E8F','\xE3\x5A':'\u1E90','\xE3\x7A':'\u1E91','\xF2\x5A':'\u1E92',
    '\xF2\x7A':'\u1E93','\xF6\x5A':'\u1E94','\xF6\x7A':'\u1E95','\xF6\x68':'\u1E96','\xE8\x74':'\u1E97','\xEA\x77':'\u1E98','\xEA\x79':'\u1E99','\xF2\x41':'\u1EA0','\xF2\x61':'\u1EA1','\xE0\x41':'\u1EA2','\xE0\x61':'\u1EA3','\xE3\xE2\x41':'\u1EA4','\xE2\xE3\x41':'\u1EA4','\xE3\xE2\x61':'\u1EA5','\xE2\xE3\x61':'\u1EA5','\xE3\xE1\x41':'\u1EA6','\xE1\xE3\x41':'\u1EA6','\xE3\xE1\x61':'\u1EA7','\xE1\xE3\x61':'\u1EA7','\xE3\xE0\x41':'\u1EA8','\xE0\xE3\x41':'\u1EA8','\xE3\xE0\x61':'\u1EA9',
    '\xE0\xE3\x61':'\u1EA9','\xE3\xE4\x41':'\u1EAA','\xE4\xE3\x41':'\u1EAA','\xE3\xE4\x61':'\u1EAB','\xE4\xE3\x61':'\u1EAB','\xE3\xF2\x41':'\u1EAC','\xF2\xE3\x41':'\u1EAC','\xE3\xF2\x61':'\u1EAD','\xF2\xE3\x61':'\u1EAD','\xE6\xE2\x41':'\u1EAE','\xE2\xE6\x41':'\u1EAE','\xE6\xE2\x61':'\u1EAF','\xE2\xE6\x61':'\u1EAF','\xE6\xE1\x41':'\u1EB0','\xE1\xE6\x41':'\u1EB0','\xE6\xE1\x61':'\u1EB1','\xE1\xE6\x61':'\u1EB1','\xE6\xE0\x41':'\u1EB2','\xE0\xE6\x41':'\u1EB2','\xE6\xE0\x61':'\u1EB3',
    '\xE0\xE6\x61':'\u1EB3','\xE6\xE4\x41':'\u1EB4','\xE4\xE6\x41':'\u1EB4','\xE6\xE4\x61':'\u1EB5','\xE4\xE6\x61':'\u1EB5','\xE6\xF2\x41':'\u1EB6','\xF2\xE6\x41':'\u1EB6','\xE6\xF2\x61':'\u1EB7','\xF2\xE6\x61':'\u1EB7','\xF2\x45':'\u1EB8','\xF2\x65':'\u1EB9','\xE0\x45':'\u1EBA','\xE0\x65':'\u1EBB','\xE4\x45':'\u1EBC','\xE4\x65':'\u1EBD','\xE3\xE2\x45':'\u1EBE','\xE2\xE3\x45':'\u1EBE','\xE3\xE2\x65':'\u1EBF','\xE2\xE3\x65':'\u1EBF','\xE3\xE1\x45':'\u1EC0','\xE1\xE3\x45':'\u1EC0',
    '\xE3\xE1\x65':'\u1EC1','\xE1\xE3\x65':'\u1EC1','\xE3\xE0\x45':'\u1EC2','\xE0\xE3\x45':'\u1EC2','\xE3\xE0\x65':'\u1EC3','\xE0\xE3\x65':'\u1EC3','\xE3\xE4\x45':'\u1EC4','\xE4\xE3\x45':'\u1EC4','\xE3\xE4\x65':'\u1EC5','\xE4\xE3\x65':'\u1EC5','\xE3\xF2\x45':'\u1EC6','\xF2\xE3\x45':'\u1EC6','\xE3\xF2\x65':'\u1EC7','\xF2\xE3\x65':'\u1EC7','\xE0\x49':'\u1EC8','\xE0\x69':'\u1EC9','\xF2\x49':'\u1ECA','\xF2\x69':'\u1ECB','\xF2\x4F':'\u1ECC','\xF2\x6F':'\u1ECD','\xE0\x4F':'\u1ECE','\xE0\x6F':'\u1ECF',
    '\xE3\xE2\x4F':'\u1ED0','\xE2\xE3\x4F':'\u1ED0','\xE3\xE2\x6F':'\u1ED1','\xE2\xE3\x6F':'\u1ED1','\xE3\xE1\x4F':'\u1ED2','\xE1\xE3\x4F':'\u1ED2','\xE3\xE1\x6F':'\u1ED3','\xE1\xE3\x6F':'\u1ED3','\xE3\xE0\x4F':'\u1ED4','\xE0\xE3\x4F':'\u1ED4','\xE3\xE0\x6F':'\u1ED5','\xE0\xE3\x6F':'\u1ED5','\xE3\xE4\x4F':'\u1ED6','\xE4\xE3\x4F':'\u1ED6','\xE3\xE4\x6F':'\u1ED7','\xE4\xE3\x6F':'\u1ED7','\xE3\xF2\x4F':'\u1ED8','\xF2\xE3\x4F':'\u1ED8','\xE3\xF2\x6F':'\u1ED9','\xF2\xE3\x6F':'\u1ED9','\xF2\x55':'\u1EE4',
    '\xF2\x75':'\u1EE5','\xE0\x55':'\u1EE6','\xE0\x75':'\u1EE7','\xE1\x59':'\u1EF2','\xE1\x79':'\u1EF3','\xF2\x59':'\u1EF4','\xF2\x79':'\u1EF5','\xE0\x59':'\u1EF6','\xE0\x79':'\u1EF7','\xE4\x59':'\u1EF8','\xE4\x79':'\u1EF9'};
  var Chars1252 = {'\x80':'\u20AC','\x81':'','\x82':'\u201A','\x83':'\u0192','\x84':'\u201E','\x85':'\u2026','\x86':'\u2020','\x87':'\u2021','\x88':'\u02C6','\x89':'\u2030','\x8A':'\u0160','\x8B':'\u2039','\x8C':'\u0152','\x8D':'','\x8E':'\u017D','\x8F':'','\x90':'','\x91':'\u2018','\x92':'\u2019','\x93':'\u201C','\x94':'\u201D','\x95':'\u2022','\x96':'\u2013','\x97':'\u2014','\x98':'\u02DC','\x99':'\u2122','\x9A':'\u0161','\x9B':'\u203A','\x9C':'\u0153','\x9D':'','\x9E':'\u017E','\x9F':'\u0178'}
  var DateSimple = function(type, day, month, year) {
    var Months = {JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 8, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12};
    var Types = {ABT: 'c.', EST: 'est.', CAL: 'cal.', AFT: '>', BEF: '<', '':''};
    this.type = type ? type : '';
    this.year = year ? +year : '';
    this.month = month ? Months[month] : '';
    this.day = day ? +day : '';
    this.exact = this.day !== '' && this.type === '' ? new Date(this.year, this.month - 1, this.day) : null;
  };
  var DateRange = function(type1, day1, month1, year1, type2, day2, month2, year2) {
    this.date1 = new DateSimple(type1, day1, month1, year1);
    this.date2 = new DateSimple(type2, day2, month2, year2);
  };
  var DatePeriod = function(type1, day1, month1, year1, type2, day2, month2, year2) {
    this.date1 = new DateSimple(type1, day1, month1, year1);
    this.date2 = new DateSimple(type2, day2, month2, year2);
  };
  function parseDate(date) {
    let regex = (function() {
      let date = '(?:(?:([1-9]|[0-2][0-9]|3[0-1])\\s+)?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\\s+)?([0-9]{3,4})'; 
      let period = 'FROM(?:\\s+(ABT|EST|CAL|BEF|AFT))?\\s+' + date + '\\s+TO(?:\\s+(ABT|EST|CAL|BEF|AFT))?\\s+' + date;
      let range = 'BET(?:\\s+(ABT|EST|CAL))?\\s+' + date + '\\s+AND(?:\\s+(ABT|EST|CAL))?\\s+' + date;
      let simple = '(?:(ABT|EST|CAL|AFT|BEF)\\s+)?' + date;
      // simple:        1:type,  2:day,  3:month,  4:year
      // range:  BET:   5:type,  6:day,  7:month,  8:year  AND:  9:type, 10:day, 11:month, 12:year
      // period: FROM: 13:type, 14:day, 15:month, 16:year  TO:  17:type, 18:day, 19:month, 20:year
      return new RegExp('^(?:' + simple + '|' + range + '|' + period + ')$', '');
    })();
    date = date || '';
    let temp = regex.exec(date.trim().toUpperCase()) || [];
    if (temp[4]) {
      return new DateSimple(temp[1], temp[2], temp[3], temp[4]);
    } else if (temp[8] && temp[12]) {
      return new DateRange(temp[5], temp[6], temp[7], temp[8], temp[9], temp[10], temp[11], temp[12]);
    } else if (temp[16] && temp[20]) {
      return new DatePeriod(temp[13], temp[14], temp[15], temp[16], temp[17], temp[18], temp[19], temp[20]);
    }
    return date;
  }
  function gedcomToJs(txt) {
    let regex = /^ *([0-9]+) +(?:@([A-Za-z0-9_]+)@ +)?([A-Za-z0-9_]+)(?: +@([A-Za-z0-9_]+)@)?(?: (.*))?$/gm;
    let root = new Fragment();
    let levels = [root];
    let temp;
    while (temp = regex.exec(txt)) {
      let level = +(temp[1]);
      let newObj = new Fragment(temp[2], temp[3], temp[4], temp[5]);
      newObj.parent = levels[level];
      levels[level].children.push(newObj);
      levels[level + 1] = newObj;
    }
    return root;
  }
  function jsToGedcom(root) {
    function recursive(obj, level) {
      if (level !== -1) {
        txt += level;
        if (obj.index) {txt += ' ' + '@' + obj.index + '@';}
        if (obj.tag) {txt += ' ' + obj.tag;}
        if (obj.value) {txt += ' ' + obj.value;}
        if (obj.ref) {txt += ' ' + '@' + obj.ref + '@';}
        txt += '\r\n';
      }
      for (let i = 0; i < obj.children.length; i++) {
        recursive(obj.children[i], level + 1);
      }
    }
    let txt = '';
    recursive(root, -1);
    return txt;
  }

  g.persons = []; g.families = []; g.notes = [];
  g.personsRecords = {}; g.familiesRecords = {}; g.notesRecords = {};
  if (txt.slice(0, 14) === '\xFE\xFF' + '0 HEAD'.replace(/./g, '\0$&')
       || txt.slice(0, 12) === '0 HEAD'.replace(/./g, '\0$&')) {
    txt = txt.replace(/[\s\S]{1,2}/g, function(x) {
      if (x === '\xFE\xFF') {return '';}
      if (x.length === 2) {return String.fromCharCode(x.charCodeAt(1) | (x.charCodeAt(0) << 8));}
      return '';
    });
    g.encoding = 'UTF-16 BE';
  } else if (txt.slice(0, 14) === '\xFF\xFE' + '0 HEAD'.replace(/./g, '$&\0')
              || txt.slice(0, 12) === '0 HEAD'.replace(/./g, '$&\0')) {
    txt = txt.replace(/[\s\S]{1,2}/g, function(x) {
      if (x === '\xFF\xFE') {return '';}
      if (x.length === 2) {return String.fromCharCode(x.charCodeAt(0) | (x.charCodeAt(1) << 8));}
      return '';
    });
    g.encoding = 'UTF-16 LE';
  } else if (txt.slice(0,9) === '\xEF\xBB\xBF' + '0 HEAD') {
    txt = txt.replace(/^\xEF\xBB\xBF/, '');
    g.encoding = 'UTF-8';
  } else if (txt.slice(0,6) !== '0 HEAD') {
    console.log(new Error('the data can\'t be parsed as gedcom'));    
    return;
  }
  var js = gedcomToJs(txt);
  g.encoding = g.encoding || js.getChild('HEAD').getChildValue('CHAR').toUpperCase();
  js.children.forEach(function(child) {
    switch (child.tag) {
      case 'INDI':
        let person = new Person(child);
        g.persons.push(person);
        g.personsRecords[child.index] = person;
        break;
      case 'FAM':
        let family = new Family(child);
        g.families.push(family);
        g.familiesRecords[child.index] = family;
        break;
      case 'NOTE':
        let note = new Note(child);
        g.notes.push(note);
        g.notesRecords[child.index] = note;
        break;
    }
  });
  g.notes.forEach(function(note) {note.init();});
  g.families.forEach(function(family) {family.init();});
  g.persons.forEach(function(person) {person.init();});
};
