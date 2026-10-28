(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CirroCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function condition(code){if(code===0)return {text:'Céu limpo',tone:'clear',icon:'sun'};if([1,2].includes(code))return {text:'Parcialmente nublado',tone:'cloudy',icon:'partly'};if(code===3)return {text:'Encoberto',tone:'cloudy',icon:'cloud'};if([45,48].includes(code))return {text:'Névoa',tone:'cloudy',icon:'cloud'};if([51,53,55,56,57].includes(code))return {text:'Garoa',tone:'rain',icon:'rain'};if([61,63,65,66,67,80,81,82].includes(code))return {text:'Chuva',tone:'rain',icon:'rain'};if([71,73,75,77,85,86].includes(code))return {text:'Neve',tone:'snow',icon:'snow'};if([95,96,99].includes(code))return {text:'Trovoadas',tone:'storm',icon:'storm'};return {text:'Condição indisponível',tone:'cloudy',icon:'cloud'};}
 function dayLabel(date){return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).format(new Date(date+'T12:00:00'));}
 function assertForecast(data){if(!data||!data.current||!data.daily||!Array.isArray(data.daily.time)||!data.daily.time.length||!Number.isFinite(data.current.temperature_2m))throw Error('A API retornou uma previsão incompleta.');return data;}
 function cityName(city){return [city.name,city.admin1,city.country].filter(Boolean).join(' · ');}
 return {condition,dayLabel,assertForecast,cityName};
});
